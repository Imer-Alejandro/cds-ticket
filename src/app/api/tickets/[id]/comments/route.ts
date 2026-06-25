import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"

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
