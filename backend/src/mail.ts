import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getPrisma } from '../lib/prisma'
import { loadEmailConfig, type EmailConfig } from '../lib/email-config'
import { notifyUsers } from './socket'
import { resolveEmailCategoriaId, resolveEmailRoleId } from '../../src/lib/mail/helpers'
import { handleIncomingEmail } from '../../src/lib/mail/ingest'
import { autoAssignAgent } from '../../src/lib/assignment'
import { makePrismaAssignmentRepo } from '../../src/lib/assignment-prisma'
import { getMicrosoftAccessToken } from '../../src/lib/mail/oauth'

let intervalHandle: ReturnType<typeof setInterval> | null = null
let processing = false

export async function checkMail(cfg?: EmailConfig) {
  if (processing) return
  processing = true
  const prisma = getPrisma()
  let client: ImapFlow | null = null

  try {
    const config = cfg || (await loadEmailConfig())
    if (!config.enabled || !config.imapHost || !config.imapUser) return

    const accessToken = config.authMode === 'oauth2' ? await getMicrosoftAccessToken(config as any) : null
    if (config.authMode !== 'oauth2' && !config.imapPass) return

    client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: accessToken ? { user: config.imapUser, accessToken } : { user: config.imapUser, pass: config.imapPass },
      logger: false,
    })

    await client.connect()
    const lock = await client.getMailboxLock(config.imapFolder)
    try {
      const result = await client.search({ seen: false })
      if (!result) return
      const msgs = result as number[]

      const categoriaId = (await resolveEmailCategoriaId({ defaultCategoriaId: config.defaultCategoriaId || '' } as any, prisma)) || undefined

      for (const seq of msgs) {
        try {
          const raw = await client.download(String(seq))
          const chunks: Buffer[] = []
          for await (const chunk of raw.content) {
            chunks.push(Buffer.from(chunk))
          }
          const parsed = await simpleParser(Buffer.concat(chunks))

          const resultIngest = await handleIncomingEmail(
            {
              repo: prisma as any,
              defaultCategoriaId: categoriaId,
              resolveRoleId: () => resolveEmailRoleId(prisma),
              autoAssign: async ({ colaId }) => autoAssignAgent(makePrismaAssignmentRepo(prisma), colaId),
              log: console.log,
            },
            parsed as any
          )

          if (!resultIngest) continue

          await client.messageFlagsAdd(seq, ['\\Seen'])

          console.log(`[Mail] ${resultIngest.kind === 'reply' ? 'Respuesta' : 'Ticket'} ${resultIngest.codigo} procesado`)

          // Notificar a los agentes por socket en tiempo real
          const agentes = await prisma.usuario.findMany({
            where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
            select: { id: true },
          })
          notifyUsers(
            agentes.map(a => a.id),
            resultIngest.kind === 'reply' ? 'ticketUpdated' : 'nuevoTicket',
            { ticket: { id: resultIngest.ticketId, codigo: resultIngest.codigo } }
          )
        } catch (err) {
          console.error('[Mail] Error procesando correo:', err)
        }
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    console.error('[Mail] Error de conexión IMAP:', err)
  } finally {
    if (client) {
      try {
        await client.logout()
      } catch {
        // ignorar errores de cierre de conexión
      }
    }
    processing = false
  }
}

export function startMailListener(cfg?: EmailConfig) {
  stopMailListener()

  if (cfg) {
    if (cfg.enabled) {
      checkMail(cfg)
      intervalHandle = setInterval(() => checkMail(cfg), (cfg.checkInterval || 10) * 1000)
      console.log('[Mail] Listener iniciado con intervalo de', cfg.checkInterval || 10, 'segundos')
    }
    return
  }

  loadEmailConfig().then((c) => {
    void checkMail(c)
    intervalHandle = setInterval(() => void checkMail(), Math.max(c.checkInterval || 10, 5) * 1000)
    console.log('[Mail] Listener iniciado con intervalo de', Math.max(c.checkInterval || 10, 5), 'segundos')
  })
}

export function stopMailListener() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[Mail] Listener detenido')
  }
}