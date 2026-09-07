import { extractTicketCode, isReplyEmail, nextTicketCode, emailBodyToText, normalizeFromAddress } from './core'
import type { AgenteCandidato } from '@/lib/assignment'

export interface IncomingEmail {
  from?: any
  subject?: string | null
  text?: string | null
  html?: string | null
  attachments?: { content: string | Buffer; contentType?: string; filename?: string }[]
  [key: string]: unknown
}

export interface ParsedDecision {
  kind: 'reply' | 'new'
  codigo?: string | null
  fromEmail?: string | null
}

/** Decide si un correo entrante es una respuesta a un ticket o una nueva solicitud. */
export function decideIncomingEmail(from: any, subject?: string | null): ParsedDecision {
  const fromEmail = normalizeFromAddress(from)
  if (isReplyEmail(subject)) {
    return { kind: 'reply', codigo: extractTicketCode(subject), fromEmail }
  }
  return { kind: 'new', codigo: null, fromEmail }
}

/** Interface mínima de Prisma que el servicio necesita. Permite inyectar stubs en tests. */
export interface TicketRepo {
  ticket: {
    findFirst(args: any): Promise<any>
    findUnique(args: any): Promise<any>
    findMany(args: any): Promise<any>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
  }
  usuario: {
    findUnique(args: any): Promise<any>
    findFirst(args: any): Promise<any>
    create(args: any): Promise<any>
  }
  rol: { findFirst(args: any): Promise<any> }
  categoria: {
    findUnique(args: any): Promise<any>
    findFirst(args: any): Promise<any>
  }
  comentario: { create(args: any): Promise<any> }
  logTicket: { create(args: any): Promise<any> }
  adjunto: { createMany(args: any): Promise<any> }
  sla: { findFirst(args: any): Promise<any> }
  cola: { findFirst(args: any): Promise<any> }
}

export interface IngestResult {
  kind: 'reply' | 'new'
  ticketId: string
  codigo: string
  reply?: boolean
}

const MAX_ADJUNTOS = 10
const MAX_TAMAÑO_BYTES = 10 * 1024 * 1024

/** Filtra adjuntos que superan el límite de la aplicación (10 archivos, 10 MB). */
export function adjuntosValidos(attachments: IncomingEmail['attachments'] = []): NonNullable<IncomingEmail['attachments']> {
  return (attachments || []).slice(0, MAX_ADJUNTOS).filter((att) => {
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '')
    return buf.length <= MAX_TAMAÑO_BYTES
  })
}

export interface IngestDeps {
  repo: TicketRepo
  defaultCategoriaId?: string
  resolveRoleId?: () => Promise<string | null>
  /** Asignación automática por carga de la cola (si está configurada). */
  autoAssign?: (info: { colaId: string }) => Promise<AgenteCandidato | null>
  log?: (msg: string) => void
}

/**
 * Crea un comentario en el ticket original cuando llega una respuesta por correo.
 * Marca la primera respuesta (para SLA) si el ticket no tenía ninguna.
 */
async function replyToTicket(deps: IngestDeps, email: IncomingEmail, codigo: string) {
  const { repo, log } = deps
  const ticket = await repo.ticket.findUnique({ where: { codigo } })
  if (!ticket) {
    log?.(`[Mail] Respuesta a ticket inexistente: ${codigo}`)
    return null
  }

  const fromEmail = normalizeFromAddress(email.from) || ''
  const body = emailBodyToText(email as any)
  const comment = await repo.comentario.create({
    data: {
      ticketId: ticket.id,
      usuarioId: ticket.solicitanteId,
      mensaje: body,
      esInterno: false,
    },
  })

  const firstResponse = await repo.logTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: ticket.solicitanteId,
      accion: 'RESPUESTA_CORREO',
      valorNuevo: `Respuesta por correo de ${fromEmail}`,
    },
  })
  void firstResponse

  if (adjuntosValidos(email.attachments).length) {
    await repo.adjunto.createMany({
      data: adjuntosValidos(email.attachments).map((att) => {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
        return {
          ticketId: ticket.id,
          comentarioId: comment.id,
          nombre: att.filename || 'sin_nombre',
          tipo: att.contentType || 'application/octet-stream',
          url: '',
          data: buf.toString('base64'),
          tamaño: buf.length,
        }
      }),
    })
  }

  log?.(`[Mail] Respuesta vinculada a ${codigo} como comentario`)
  return ticket
}

/**
 * Punto de entrada unificado: procesa un correo entrante y crea ticket (nuevo)
 * o comenta el ticket existente (respuesta). Devuelve el resultado o null.
 *
 * Este es el corazón compartido que usan tanto el listener de Next.js
 * (cron) como el backend del servidor de correo.
 */
export async function handleIncomingEmail(
  deps: IngestDeps,
  email: IncomingEmail
): Promise<IngestResult | null> {
  const { repo, log } = deps
  const decision = decideIncomingEmail(email.from, email.subject)
  const fromEmail = decision.fromEmail

  if (!fromEmail) {
    log?.('[Mail] Ignorado: sin dirección de remitente')
    return null
  }

  // Respuesta a ticket existente → crear comentario
  if (decision.kind === 'reply' && decision.codigo) {
    const replied = await replyToTicket(deps, email, decision.codigo)
    if (replied) {
      return { kind: 'reply', ticketId: replied.id, codigo: decision.codigo, reply: true }
    }
    // Si el código no existe, no crear ticket nuevo con un código fantasma:
    // continuamos al flujo normal pero sin el código en el asunto.
  }

  // Obtener o crear el usuario solicitante
  let solicitante = await repo.usuario.findFirst({
    where: { correo: { equals: fromEmail, mode: 'insensitive' } },
  })
  if (!solicitante) {
    const roleId = (await deps.resolveRoleId?.()) || null
    const fromNameRaw = (email.from as any)?.value?.[0]?.name || fromEmail.split('@')[0]
    solicitante = await repo.usuario.create({
      data: {
        nombre: fromNameRaw,
        apellido: '',
        correo: fromEmail,
        userName: `${fromEmail.split('@')[0]}_${Date.now()}`,
        password: null,
        rolId: roleId,
        departamentoId: null,
      },
    })
  }

  // Categoría
  let categoriaId = deps.defaultCategoriaId?.trim() || null
  let categoriaColaId: string | null = null
  if (categoriaId) {
    const cat = await repo.categoria.findUnique({ where: { id: categoriaId }, select: { id: true, colaDefaultId: true } })
    if (!cat) categoriaId = null
    else categoriaColaId = cat.colaDefaultId ?? null
  }
  if (!categoriaId) {
    const fallback = await repo.categoria.findFirst({ orderBy: { nombre: 'asc' } })
    categoriaId = fallback?.id ?? null
  }
  if (!categoriaId) {
    log?.('[Mail] Sin categoría por defecto, correo ignorado')
    return null
  }

  // Código concurrente-safe y SLA por categoría+prioridad
  const lastTickets = await repo.ticket.findMany({ orderBy: { codigo: 'desc' }, take: 10, select: { codigo: true } })
  const codigo = nextTicketCode(lastTickets.map((t: { codigo: string }) => t.codigo))

  const sla = await repo.sla.findFirst({
    where: { categoriaId, prioridad: 'MEDIA' },
  })

  const subject = (email.subject || '(Sin asunto)').substring(0, 200)
  const descripcion = emailBodyToText(email as any, 2000)

  const ticket = await repo.ticket.create({
    data: {
      codigo,
      asunto: subject,
      descripcion,
      estado: 'NUEVO',
      nivelPrioridad: 'MEDIA',
      solicitanteId: solicitante.id,
      categoriaId,
      slaId: sla?.id ?? null,
      origen: 'CORREO',
    },
    include: { solicitante: { select: { nombre: true, apellido: true, correo: true } } },
  })

  await repo.logTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: solicitante.id,
      accion: 'CREACION',
      valorNuevo: 'Ticket creado desde correo',
    },
  })

  // Asignación automática por cola, si está configurada (FASE B)
  let agenteAsignadoId: string | null = null
  if (deps.autoAssign && categoriaColaId) {
    try {
      const agente = await deps.autoAssign({ colaId: categoriaColaId })
      if (agente) {
        agenteAsignadoId = agente.id
        await repo.ticket.update({
          where: { id: ticket.id },
          data: { agenteId: agente.id, estado: 'ASIGNADO' },
        })
        await repo.logTicket.create({
          data: {
            ticketId: ticket.id,
            usuarioId: solicitante.id,
            accion: 'ASIGNACION',
            valorAnterior: 'Sin asignar',
            valorNuevo: agente.nombre ? `${agente.nombre} (${agente.id})` : agente.id,
          },
        })
        log?.(`[Mail] Ticket ${codigo} auto-asignado a ${agente.nombre || agente.id}`)
      }
    } catch (err) {
      log?.(`[Mail] Error en asignación automática de ${codigo}: ${(err as Error).message}`)
    }
  }
  void agenteAsignadoId

  if (adjuntosValidos(email.attachments).length) {
    await repo.adjunto.createMany({
      data: adjuntosValidos(email.attachments).map((att) => {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
        return {
          ticketId: ticket.id,
          nombre: att.filename || 'sin_nombre',
          tipo: att.contentType || 'application/octet-stream',
          url: '',
          data: buf.toString('base64'),
          tamaño: buf.length,
        }
      }),
    })
  }

  log?.(`[Mail] Ticket ${codigo} creado desde correo de ${fromEmail}`)
  return { kind: 'new', ticketId: ticket.id, codigo }
}