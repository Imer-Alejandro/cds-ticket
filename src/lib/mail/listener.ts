import prisma from '@/lib/prisma'
import { loadEmailConfig, type EmailConfig } from './config'
import { resolveEmailCategoriaId, resolveEmailRoleId } from './helpers'
import { handleIncomingEmail, type IngestResult, type IncomingEmail, type TicketRepo } from './ingest'
import { runMailCheck, configPersistence, type MailCheckStatus } from './check'
import { createNotification, emitTicketUpdate } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData } from './notify-email'
import { autoAssignAgent } from '@/lib/assignment'
import { makePrismaAssignmentRepo } from '@/lib/assignment-prisma'

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
      autoAssign: async ({ colaId }) => autoAssignAgent(makePrismaAssignmentRepo(prisma), colaId),
      log: console.log,
    },
    parsed
  )
}

/** Notifica en la app (agentes) y por correo al(s) implicado(s). */
async function notifyIngestResult(result: IngestResult): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: result.ticketId },
    include: {
      solicitante: { select: { id: true, nombre: true, apellido: true, correo: true } },
      agente: { select: { id: true, nombre: true, correo: true } },
    },
  })
  if (!ticket) return

  if (result.kind === 'new') {
    const agentes = await prisma.usuario.findMany({
      where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
      select: { id: true },
    })
    for (const agente of agentes) {
      await createNotification(agente.id, 'NUEVO_TICKET', `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`, ticket.id)
    }
    notifyByEmail({
      type: 'TICKET_CREADO',
      to: ticket.solicitante.correo,
      nombre: `${ticket.solicitante.nombre}`,
      data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
    })
    void emitTicketUpdate({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'nuevo', 'email')
  } else {
    if (ticket.agente) {
      await createNotification(ticket.agente.id, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo} (por correo)`, ticket.id)
      notifyByEmail({
        type: 'NUEVO_COMENTARIO',
        to: ticket.agente.correo,
        nombre: ticket.agente.nombre,
        data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
        comentario: 'El solicitante respondió por correo.',
      })
    }
    void emitTicketUpdate({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'comentario', 'email')
  }
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
      onResult: notifyIngestResult,
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
  if (result) await notifyIngestResult(result)
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
  })
  return true
}
