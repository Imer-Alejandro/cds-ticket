import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.ticketId || !data.mensaje) {
      return NextResponse.json({ error: 'ticketId y mensaje son requeridos' }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: data.ticketId } })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const comment = await prisma.comentario.create({
      data: {
        ticketId: data.ticketId,
        usuarioId: session.id as string,
        mensaje: data.mensaje,
        esInterno: data.esInterno || false,
      },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 })
  }
}
