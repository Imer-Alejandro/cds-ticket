import prisma from '@/lib/prisma'
import { loadEmailConfig, type EmailConfig } from './config'
import { resolveEmailCategoriaId, resolveEmailRoleId } from './helpers'
import { handleIncomingEmail, type IngestResult, type IncomingEmail, type TicketRepo } from './ingest'
import { runMailCheck, configPersistence, type MailCheckStatus } from './check'
import { notifyIngestResult } from './notify-ingest'
import { notifyByEmail, toTicketEmailData } from './notify-email'
import { threadHeadersFromTicket } from './comment-email'
import { autoAssignAgent } from '@/lib/assignment'
import { makePrismaAssignmentRepo } from '@/lib/assignment-prisma'
import { resolveRouting } from '@/lib/auto-route'

let timerHandle: ReturnType<typeof setTimeout> | null = null
let stopped = true
let inFlight: Promise<MailCheckStatus> | null = null

/** Ingresa un correo parseado (ticket nuevo o respuesta) sin notificar. */
async function ingestParsed(parsed: IncomingEmail, config: EmailConfig): Promise<IngestResult | null> {
  const defaultCategoriaId = (await resolveEmailCategoriaId(config, prisma)) ?? undefined
  return handleIncomingEmail(
    {
      repo: prisma as unknown as TicketRepo,
      defaultCategoriaId,
      resolveRoleId: () => resolveEmailRoleId(prisma),
      resolverCategoria: (info) => resolveRouting(prisma, info),
      autoAssign: async ({ colaId }) => autoAssignAgent(makePrismaAssignmentRepo(prisma), colaId),
      systemFroms: [config.fromAddress, config.smtpUser].filter((v): v is string => Boolean(v)),
      log: console.log,
    },
    parsed
  )
}

/**
 * Revisión única de la bandeja (compatible con password y Microsoft 365 OAuth2).
 * Filtra el histórico con `monitorAfter` y marca los correos procesados como
 * leídos. Si ya hay una revisión en curso se reutiliza esa promesa.
 */
export async function processIncomingEmails(): Promise<MailCheckStatus> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const persist = configPersistence(prisma.configuracion)
    return runMailCheck({
      loadConfig: loadEmailConfig,
      ingest: ingestParsed,
      onResult: (result) => notifyIngestResult(result),
      ...persist,
    })
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * Procesa un correo ya parseado: decide entre ticket nuevo o respuesta,
 * crea/vincula el ticket y dispara notificaciones en app + email.
 * Compatibilidad con llamadas directas (scripts/tests).
 */
export async function processIncomingEmail(parsed: IncomingEmail): Promise<IngestResult | null> {
  const config = await loadEmailConfig()
  const result = await ingestParsed(parsed, config)
  if (result && result.kind !== 'duplicate' && result.ticketId) await notifyIngestResult(result)
  return result
}

async function runLoop() {
  let delay = 15
  try {
    const cfg = await loadEmailConfig()
    delay = Math.max(cfg.checkInterval || 15, 5)
  } catch (err) {
    console.error('[Mail] No se pudo leer la configuración de correo:', err)
  }
  await processIncomingEmails()
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
  }
}

/** Compatibilidad: envía una respuesta por correo al solicitante del ticket. */
export async function sendEmailReply(ticketId: string, message: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { solicitante: { select: { nombre: true, correo: true } } },
  })
  if (!ticket) throw new Error('Ticket not found')

  notifyByEmail({
    type: 'NUEVO_COMENTARIO',
    to: ticket.solicitante.correo,
    nombre: ticket.solicitante.nombre,
    data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
    comentario: message,
    ...threadHeadersFromTicket(ticket),
  })
  return true
}
