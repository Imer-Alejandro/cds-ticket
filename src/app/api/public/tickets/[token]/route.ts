import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyPublicTicketToken } from '@/lib/public-ticket'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const ticketId = await verifyPublicTicketToken(token)
    if (!ticketId) {
      return NextResponse.json({ error: 'Enlace inválido o expirado' }, { status: 404 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId, estado: { not: 'ELIMINADO' } },
      select: {
        codigo: true,
        asunto: true,
        descripcion: true,
        estado: true,
        nivelPrioridad: true,
        fechaCreacion: true,
        fechaResolucion: true,
        fechaCierre: true,
        categoria: { select: { nombre: true } },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    }

    return NextResponse.json(ticket)
  } catch {
    return NextResponse.json({ error: 'Error en el enlace de seguimiento' }, { status: 500 })
  }
}