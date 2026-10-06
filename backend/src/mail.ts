import { getPrisma } from '../lib/prisma'
import { loadEmailConfig, type EmailConfig } from '../lib/email-config'
import { notifyUsers } from './socket'
import { resolveEmailCategoriaId, resolveEmailRoleId } from '../../src/lib/mail/helpers'
import { handleIncomingEmail, type IncomingEmail, type TicketRepo } from '../../src/lib/mail/ingest'
import { autoAssignAgent } from '../../src/lib/assignment'
import { makePrismaAssignmentRepo } from '../../src/lib/assignment-prisma'
import { runMailCheck, configPersistence, type MailCheckStatus } from '../../src/lib/mail/check'

let timerHandle: ReturnType<typeof setTimeout> | null = null
let stopped = true
let inFlight: Promise<MailCheckStatus> | null = null

async function runCheck(cfg?: EmailConfig): Promise<MailCheckStatus> {
  const prisma = getPrisma()
  const persist = configPersistence(prisma.configuracion)

  return runMailCheck({
    loadConfig: async () => cfg ?? (await loadEmailConfig()),
    ingest: async (parsed, config) => {
      const categoriaId = (await resolveEmailCategoriaId(config, prisma)) || undefined
      return handleIncomingEmail(
        {
          repo: prisma as unknown as TicketRepo,
          defaultCategoriaId: categoriaId,
          resolveRoleId: () => resolveEmailRoleId(prisma),
          autoAssign: async ({ colaId }) => autoAssignAgent(makePrismaAssignmentRepo(prisma), colaId),
          log: console.log,
        },
        parsed as IncomingEmail
      )
    },
    onResult: async (result) => {
      const agentes = await prisma.usuario.findMany({
        where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
        select: { id: true },
      })
      notifyUsers(
        agentes.map(a => a.id),
        result.kind === 'reply' ? 'ticketUpdated' : 'nuevoTicket',
        { ticket: { id: result.ticketId, codigo: result.codigo } }
      )
    },
    ...persist,
  })
}

/** Revisión de bandeja; si ya hay una en curso se reutiliza esa promesa. */
export function checkMail(cfg?: EmailConfig): Promise<MailCheckStatus> {
  if (inFlight) return inFlight
  inFlight = runCheck(cfg).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runLoop() {
  let cfg: EmailConfig | undefined
  let delay = 15
  try {
    cfg = await loadEmailConfig()
    delay = Math.max(cfg.checkInterval || 15, 5)
  } catch (err) {
    console.error('[Mail] No se pudo leer la configuración de correo:', err)
  }
  await checkMail(cfg)
  if (!stopped) {
    timerHandle = setTimeout(() => void runLoop(), delay * 1000)
  }
}

export function startMailListener() {
  stopMailListener()
  stopped = false
  console.log('[Mail] Listener iniciado; relee la configuración en cada ciclo')
  void runLoop()
}

export function stopMailListener() {
  stopped = true
  if (timerHandle) {
    clearTimeout(timerHandle)
    timerHandle = null
    console.log('[Mail] Listener detenido')
  }
}
