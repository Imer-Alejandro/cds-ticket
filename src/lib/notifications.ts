import prisma from './prisma'
import { getIO } from './socket-server'

type NotificationType = 'NUEVO_TICKET' | 'CAMBIO_ESTADO' | 'ASIGNACION' | 'NUEVO_COMENTARIO'

export async function createNotification(
  usuarioId: string,
  tipo: NotificationType,
  mensaje: string,
  ticketId: string,
) {
  const notificacion = await prisma.notificacion.create({
    data: { usuarioId, tipo, mensaje, ticketId },
    include: { ticket: { select: { codigo: true, asunto: true } } },
  })

  const io = getIO()
  if (io) {
    io.to(`user:${usuarioId}`).emit('notificacion', {
      type: tipo,
      notificacion: {
        id: notificacion.id,
        tipo: notificacion.tipo,
        mensaje: notificacion.mensaje,
        leido: notificacion.leido,
        fecha: notificacion.fecha.toISOString(),
        ticket: notificacion.ticket,
      },
    })
  }
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
