import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getPrisma } from '../lib/prisma'
import { loadEmailConfig, type EmailConfig } from '../lib/email-config'
import { notifyUsers } from './socket'
import { resolveEmailCategoriaId, resolveEmailRoleId } from '../../src/lib/mail/helpers'
import { handleIncomingEmail } from '../../src/lib/mail/ingest'
import { autoAssignAgent } from '../../src/lib/assignment'
import { makePrismaAssignmentRepo } from '../../src/lib/assignment-prisma'

let intervalHandle: ReturnType<typeof setInterval> | null = null

export async function checkMail(cfg?: EmailConfig) {
  const prisma = getPrisma()
  const config = cfg || (await loadEmailConfig())
  if (!config.enabled || !config.imapHost || !config.imapUser) return

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.imapUser, pass: config.imapPass },
    logger: false,
  })

  try {
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
    await client.logout()
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
    if (c.enabled) {
      checkMail(c)
      intervalHandle = setInterval(() => checkMail(c), (c.checkInterval || 10) * 1000)
      console.log('[Mail] Listener iniciado con intervalo de', c.checkInterval || 10, 'segundos')
    }
  })
}

export function stopMailListener() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[Mail] Listener detenido')
  }
}