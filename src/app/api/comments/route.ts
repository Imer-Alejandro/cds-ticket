import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.ticketId || !data.mensaje) {
      return NextResponse.json({ error: 'ticketId y mensaje son requeridos' }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      select: { id: true, codigo: true, solicitanteId: true, agenteId: true },
    })
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

    if (data.adjuntos && Array.isArray(data.adjuntos)) {
      await prisma.adjunto.createMany({
        data: data.adjuntos.map((a: any) => ({
          ticketId: data.ticketId,
          comentarioId: comment.id,
          nombre: a.nombre,
          tipo: a.tipo,
          url: a.url || '',
          data: a.data,
          tamaño: a.tamaño,
        })),
      })
    }

    if (!data.esInterno) {
      if (ticket.solicitanteId !== session.id) {
        await createNotification(ticket.solicitanteId, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo}`, ticket.id)
      }
      if (ticket.agenteId && ticket.agenteId !== session.id) {
        await createNotification(ticket.agenteId, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo}`, ticket.id)
      }
    }

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 })
  }
}
