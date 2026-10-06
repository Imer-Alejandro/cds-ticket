import prisma from '@/lib/prisma'
import { createNotification, emitTicketUpdate } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData, type EmailEvent } from './notify-email'
import { threadHeadersFromTicket } from './comment-email'
import type { IngestResult } from './ingest'

type TipoNotificacion = 'NUEVO_TICKET' | 'NUEVO_COMENTARIO'

/** Vista mínima del ticket que necesita la notificación. */
export interface TicketNotificacion {
  id: string
  codigo: string
  asunto: string
  descripcion?: string | null
  estado: string
  nivelPrioridad: string
  solicitante: { id: string; nombre: string; apellido: string; correo: string }
  agente: { id: string; nombre: string; apellido?: string | null; correo: string } | null
  messageId?: string | null
  threadRefs?: string | null
  ultimoMessageId?: string | null
}

/** Dependencias inyectables para poder testear sin tocar BD ni red. */
export interface NotifyIngestDeps {
  findTicket(ticketId: string): Promise<TicketNotificacion | null>
  /** Agentes y administradores (posibles destinatarios de alertas). */
  findAgentes(): Promise<{ id: string; nombre: string }[]>
  findAdministradores(): Promise<{ id: string; nombre: string; correo: string | null }[]>
  notify(usuarioId: string, tipo: TipoNotificacion, mensaje: string, ticketId: string): Promise<void>
  sendEmail(ev: EmailEvent): void
  emit(ticket: { id: string; codigo: string; asunto: string }, action: 'nuevo' | 'comentario'): void
}

export const defaultNotifyDeps: NotifyIngestDeps = {
  findTicket: (ticketId) =>
    prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, correo: true } },
        agente: { select: { id: true, nombre: true, apellido: true, correo: true } },
      },
    }),
  findAgentes: () =>
    prisma.usuario.findMany({
      where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
      select: { id: true, nombre: true },
    }),
  findAdministradores: () =>
    prisma.usuario.findMany({
      where: { rol: { nombre: 'Administrador' } },
      select: { id: true, nombre: true, correo: true },
    }),
  notify: (usuarioId, tipo, mensaje, ticketId) => createNotification(usuarioId, tipo, mensaje, ticketId),
  sendEmail: (ev) => notifyByEmail(ev),
  emit: (ticket, action) => void emitTicketUpdate(ticket, action, 'email'),
}

/**
 * Notifica en la app (campanita) y por correo el resultado de ingerir un correo:
 * - kind 'new': a todos los agentes/administradores + acuse al solicitante.
 * - kind 'reply': al agente asignado y a todos los administradores.
 * - kind 'duplicate': no notifica nada.
 */
export async function notifyIngestResult(
  result: IngestResult,
  deps: NotifyIngestDeps = defaultNotifyDeps
): Promise<void> {
  if (result.kind === 'duplicate' || !result.ticketId) return

  const ticket = await deps.findTicket(result.ticketId)
  if (!ticket) return

  const data = toTicketEmailData(ticket)
  const thread = threadHeadersFromTicket(ticket)
  const emailComentario = 'El solicitante respondió por correo.'

  if (result.kind === 'new') {
    const agentes = await deps.findAgentes()
    for (const agente of agentes) {
      await deps.notify(agente.id, 'NUEVO_TICKET', `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`, ticket.id)
    }
    deps.sendEmail({
      type: 'TICKET_CREADO',
      to: ticket.solicitante.correo,
      nombre: ticket.solicitante.nombre,
      data,
      ...thread,
    })
    deps.emit({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'nuevo')
    return
  }

  // Respuesta por correo: agente asignado + todos los administradores (sin duplicados).
  const destinatarios = new Map<string, { id: string; nombre: string; correo: string | null }>()
  if (ticket.agente) {
    destinatarios.set(ticket.agente.id, { id: ticket.agente.id, nombre: ticket.agente.nombre, correo: ticket.agente.correo })
  }
  for (const admin of await deps.findAdministradores()) {
    if (!destinatarios.has(admin.id)) destinatarios.set(admin.id, admin)
  }

  const mensaje = `Nuevo comentario en ${ticket.codigo} (por correo)`
  for (const dest of destinatarios.values()) {
    await deps.notify(dest.id, 'NUEVO_COMENTARIO', mensaje, ticket.id)
    if (dest.correo) {
      deps.sendEmail({
        type: 'NUEVO_COMENTARIO',
        to: dest.correo,
        nombre: dest.nombre,
        data,
        comentario: emailComentario,
        ...thread,
      })
    }
  }

  deps.emit({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'comentario')
}
