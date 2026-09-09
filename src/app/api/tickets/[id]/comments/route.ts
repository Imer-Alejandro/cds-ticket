import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"

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

    return NextResponse.json(comentario, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}
