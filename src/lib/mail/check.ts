import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { EmailConfig } from './config'
import type { IngestResult, IncomingEmail } from './ingest'
import { getMicrosoftAccessToken } from './oauth'

/** Estado de una revisión de bandeja; se persiste en Configuracion/email_lastStatus. */
export interface MailCheckStatus {
  at: string
  ok: boolean
  mode: 'password' | 'oauth2'
  folder: string
  found: number
  processed: number
  ignored: number
  errors: number
  baseline: boolean
  message: string
}

export interface MailClientAuth {
  user: string
  accessToken?: string
  pass?: string
}

export interface MailCheckHooks {
  loadConfig(): Promise<EmailConfig>
  /** Procesa un correo parseado. Devuelve null si se ignora (ya examinado). */
  ingest(parsed: IncomingEmail, config: EmailConfig): Promise<IngestResult | null>
  onResult?(result: IngestResult, config: EmailConfig): Promise<void> | void
  saveMonitorAfter(iso: string): Promise<void>
  saveStatus(status: MailCheckStatus): Promise<void>
  saveRefreshToken?(refreshToken: string): Promise<void>
  createClient?(config: EmailConfig, auth: MailClientAuth): ImapFlow
  log?(message: string): void
  errorLog?(message: string): void
  now?(): Date
}

function defaultCreateClient(config: EmailConfig, auth: MailClientAuth): ImapFlow {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: auth.accessToken
      ? { user: auth.user, accessToken: auth.accessToken }
      : { user: auth.user, pass: auth.pass || '' },
    logger: false,
  })
}

/**
 * Revisión única de la bandeja: valida la configuración, fija la línea base de
 * monitoreo (para NO importar el histórico), conecta por IMAP/OAuth2, procesa
 * solo los correos no leídos posteriores a `monitorAfter` y marca `\Seen`.
 *
 * Toda salida (incluidas las que antes eran silenciosas) queda logueada y
 * registrada en el estado persistido para que la UI pueda mostrarla.
 */
export async function runMailCheck(hooks: MailCheckHooks): Promise<MailCheckStatus> {
  const log = hooks.log ?? console.log
  const logError = hooks.errorLog ?? console.error
  const now = hooks.now ?? (() => new Date())
  const status: MailCheckStatus = {
    at: now().toISOString(),
    ok: true,
    mode: 'password',
    folder: '',
    found: 0,
    processed: 0,
    ignored: 0,
    errors: 0,
    baseline: false,
    message: '',
  }
  let client: ImapFlow | null = null

  try {
    const config = await hooks.loadConfig()
    status.mode = config.authMode
    status.folder = config.imapFolder

    if (!config.enabled) {
      status.message = 'Recepción desactivada: activa "Activar recepción automática" en Configuración → Correo.'
      log(`[Mail] ${status.message}`)
      return status
    }

    if (!config.imapHost?.trim() || !config.imapUser?.trim()) {
      status.ok = false
      status.message = 'Configuración IMAP incompleta: falta "Servidor IMAP" o "Usuario".'
      logError(`[Mail] ${status.message} El monitoreo NO está activo.`)
      return status
    }

    if (
      config.authMode === 'oauth2' &&
      config.oauthMailbox &&
      config.oauthMailbox.trim().toLowerCase() !== config.imapUser.trim().toLowerCase()
    ) {
      status.ok = false
      status.message = 'La cuenta autorizada en Microsoft 365 no coincide con Usuario IMAP.'
      logError(`[Mail] ${status.message} Vuelve a conectar esa misma cuenta.`)
      return status
    }

    // Línea base: la primera revisión fija el punto de inicio y NO importa el
    // histórico de la bandeja (evita convertir correos antiguos en tickets).
    if (!config.monitorAfter) {
      const iso = now().toISOString()
      await hooks.saveMonitorAfter(iso)
      status.baseline = true
      status.message = 'Punto inicial de monitoreo establecido; el histórico no se importará. La próxima revisión procesará los correos nuevos.'
      log(`[Mail] ${status.message}`)
      return status
    }

    let accessToken: string | undefined
    if (config.authMode === 'oauth2') {
      accessToken = await getMicrosoftAccessToken(config, hooks.saveRefreshToken)
    } else if (!config.imapPass) {
      status.ok = false
      status.message = 'Falta la contraseña IMAP (autenticación por usuario y contraseña).'
      logError(`[Mail] ${status.message} El monitoreo NO está activo.`)
      return status
    }

    const createClient = hooks.createClient ?? defaultCreateClient
    client = createClient(
      config,
      accessToken ? { user: config.imapUser, accessToken } : { user: config.imapUser, pass: config.imapPass },
    )

    await client.connect()
    const lock = await client.getMailboxLock(config.imapFolder)
    try {
      const monitorAfter = config.monitorAfter ? new Date(config.monitorAfter) : null
      const candidates = ((await client.search({
        seen: false,
        ...(monitorAfter ? { since: monitorAfter } : {}),
      })) || []) as number[]
      const metadata = candidates.length
        ? await client.fetchAll(candidates, { internalDate: true })
        : []
      const seqs = metadata
        .filter(message => !monitorAfter || (message.internalDate && message.internalDate >= monitorAfter))
        .map(message => message.seq)
      const historicCount = candidates.length - seqs.length
      if (historicCount > 0) {
        log(`[Mail] ${historicCount} correo(s) histórico(s) sin leer omitido(s)`)
      }
      status.found = seqs.length

      if (!seqs.length) {
        status.message = `Sin correos no leídos en ${config.imapFolder}`
        log(`[Mail] ${status.message}; próxima revisión en ${Math.max(config.checkInterval || 15, 5)} segundos`)
        return status
      }

      log(`[Mail] ${seqs.length} correo(s) no leído(s) encontrado(s) en ${config.imapFolder}`)

      for (const seq of seqs) {
        try {
          const raw = await client.download(String(seq))
          const chunks: Buffer[] = []
          for await (const chunk of raw.content) {
            chunks.push(Buffer.from(chunk))
          }
          const parsed = await simpleParser(Buffer.concat(chunks))
          const result = await hooks.ingest(parsed as unknown as IncomingEmail, config)

          // Se marca como leído también cuando se ignora: evita que el mismo
          // correo se descargue en bucle en cada revisión.
          await client.messageFlagsAdd(seq, ['\\Seen'])

          if (!result) {
            status.ignored++
            log(`[Mail] Correo #${seq} ignorado (sin remitente o sin categoría); se marca como leído`)
            continue
          }

          status.processed++
          log(`[Mail] ${result.kind === 'reply' ? 'Respuesta' : 'Ticket'} ${result.codigo} procesado`)

          try {
            await hooks.onResult?.(result, config)
          } catch (err) {
            status.errors++
            logError(`[Mail] Fallo al notificar ${result.codigo}: ${err instanceof Error ? err.message : err}`)
          }
        } catch (err) {
          // Error transitorio (red/BD): NO se marca \Seen para reintentar.
          status.errors++
          logError(`[Mail] Error procesando correo #${seq}: ${err instanceof Error ? err.message : err}`)
        }
      }

      status.message = `${status.processed} procesado(s), ${status.ignored} ignorado(s), ${status.errors} error(es)`
    } finally {
      lock.release()
    }
  } catch (err) {
    status.ok = false
    status.message = err instanceof Error ? err.message : String(err)
    logError(`[Mail] Error en la revisión de correo: ${status.message}`)
  } finally {
    if (client) {
      try {
        await client.logout()
      } catch {
        // ignorar errores de cierre de conexión
      }
    }
    status.at = now().toISOString()
    try {
      await hooks.saveStatus(status)
    } catch (err) {
      logError(`[Mail] No se pudo guardar el estado de revisión: ${err instanceof Error ? err.message : err}`)
    }
  }

  return status
}

/** Persistencia de la configuración de correo (Configuracion, grupo 'email'). */
export interface ConfiguracionStore {
  upsert(args: {
    where: { clave: string }
    update: { valor: string }
    create: { clave: string; valor: string; grupo: string }
  }): Promise<unknown>
}

/**
 * Devuelve los hooks de persistencia del escáner para cualquier cliente
 * Prisma (backend y frontend comparten esta lógica).
 */
export function configPersistence(store: ConfiguracionStore) {
  const persist = async (clave: string, valor: string) => {
    await store.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor, grupo: 'email' },
    })
  }
  return {
    async saveMonitorAfter(iso: string) {
      await persist('email_monitorAfter', iso)
    },
    async saveRefreshToken(refreshToken: string) {
      await persist('email_refreshToken', refreshToken)
    },
    async saveStatus(status: MailCheckStatus) {
      await persist('email_lastStatus', JSON.stringify(status))
    },
  }
}
