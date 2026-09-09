import prisma from './prisma'
import { getIO } from './socket-server'

async function emitSocketEvent(event: string, payload: any, room?: string) {
  const io = getIO()
  if (io) {
    if (room) io.to(room).emit(event, payload)
    else io.emit(event, payload)
    return
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '')
  try {
    await fetch(`${baseUrl}/socket/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, payload, room }),
    })
  } catch {
    // ignore; the notification should not break the ticket flow
  }
}

type NotificationType = 'NUEVO_TICKET' | 'CAMBIO_ESTADO' | 'ASIGNACION' | 'NUEVO_COMENTARIO'

export async function createNotification(
  usuarioId: string,
  tipo: NotificationType,
  mensaje: string,
  ticketId: string,
) {
  if (!usuarioId) return
  try {
    const notificacion = await prisma.notificacion.create({
      data: { usuarioId, tipo, mensaje, ticketId },
      include: { ticket: { select: { id: true, codigo: true, asunto: true } } },
    })

    await emitSocketEvent('notificacion', {
      type: tipo,
      notificacion: {
        id: notificacion.id,
        tipo: notificacion.tipo,
        mensaje: notificacion.mensaje,
        leido: notificacion.leido,
        fecha: notificacion.fecha.toISOString(),
        ticket: notificacion.ticket,
      },
    }, `user:${usuarioId}`)
  } catch (err) {
    console.error('Error al crear notificación:', err)
  }
}

export async function emitTicketUpdate(ticket: any, action: string, actorId?: string) {
  await emitSocketEvent('ticketUpdated', {
    action,
    ticket,
    actorId,
    timestamp: new Date().toISOString(),
  })
}

export async function notifyAgentes(ticketId: string, tipo: NotificationType, mensaje: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { solicitanteId: true, agenteId: true, cola: { select: { equipo: { select: { miembros: { select: { usuarioId: true } } } } } } },
  })
  if (!ticket) return
  const userIds = new Set<string>()
  if (ticket.agenteId) userIds.add(ticket.agenteId)
  if (ticket.cola?.equipo?.miembros) {
    for (const m of ticket.cola.equipo.miembros) userIds.add(m.usuarioId)
  }
  for (const uid of userIds) {
    await createNotification(uid, tipo, mensaje, ticketId)
  }
}
