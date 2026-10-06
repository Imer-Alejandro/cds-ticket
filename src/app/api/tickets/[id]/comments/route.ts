import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { createNotification } from "@/lib/notifications"
import { notifyByEmail } from "@/lib/mail/notify-email"
import { buildCommentEmailEvents } from "@/lib/mail/comment-email"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { id: ticketId } = await params
    const body = await request.json()
    const { mensaje, esInterno } = body

    if (!mensaje) {
      return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })

    const puedeVerTodo = hasPermission(session, 'tickets.viewAll')
    const puedeVerAsignados = hasPermission(session, 'tickets.viewAssigned')
    const puedeVerPropios = hasPermission(session, 'tickets.viewOwn')
    const puedeVerComentariosInternos = hasPermission(session, 'tickets.viewInternalComments')
    const esSolicitante = ticket.solicitanteId === (session.id as string)
    const esAgenteAsignado = ticket.agenteId === (session.id as string)

    const tieneAcceso =
      puedeVerTodo ||
      esAgenteAsignado ||
      (puedeVerPropios && esSolicitante) ||
      (puedeVerAsignados && esSolicitante)

    if (!tieneAcceso) {
      return NextResponse.json({ error: "No tienes acceso a este ticket" }, { status: 403 })
    }

    if (esInterno && !puedeVerComentariosInternos) {
      return NextResponse.json({ error: "No tienes permisos para crear comentarios internos" }, { status: 403 })
    }

    const comentario = await prisma.comentario.create({
      data: {
        ticketId,
        usuarioId: session.id as string,
        mensaje,
        esInterno: esInterno || false,
      },
      include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
    })

    // Notificaciones (nunca para comentarios internos): in-app y email con hilo SMTP
    if (!esInterno) {
      try {
        if (ticket.solicitanteId && ticket.solicitanteId !== (session.id as string)) {
          await createNotification(ticket.solicitanteId, "NUEVO_COMENTARIO", `Nuevo comentario en ${ticket.codigo}`, ticket.id)
        }
        if (ticket.agenteId && ticket.agenteId !== (session.id as string)) {
          await createNotification(ticket.agenteId, "NUEVO_COMENTARIO", `Nuevo comentario en ${ticket.codigo}`, ticket.id)
        }

        const [solicitante, agente] = await Promise.all([
          ticket.solicitanteId ? prisma.usuario.findUnique({ where: { id: ticket.solicitanteId } }) : null,
          ticket.agenteId ? prisma.usuario.findUnique({ where: { id: ticket.agenteId } }) : null,
        ])
        const events = buildCommentEmailEvents({
          ticket,
          autorId: session.id as string,
          esInterno: Boolean(esInterno),
          solicitante: solicitante
            ? {
                id: solicitante.id,
                nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim() || solicitante.nombre,
                correo: solicitante.correo,
              }
            : null,
          agente: agente
            ? {
                id: agente.id,
                nombre: `${agente.nombre} ${agente.apellido}`.trim() || agente.nombre,
                correo: agente.correo,
              }
            : null,
          comentario: mensaje,
        })
        for (const ev of events) {
          notifyByEmail(ev)
        }
      } catch (e) {
        console.error("Error notificando comentario:", e)
      }
    }

    return NextResponse.json(comentario, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}
