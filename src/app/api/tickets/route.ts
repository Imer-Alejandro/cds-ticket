import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notifyAgentes, createNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const estado = searchParams.get('estado') || ''
    const prioridad = searchParams.get('prioridad') || ''
    const sortField = searchParams.get('sortField') || 'fechaCreacion'
    const sortDir = searchParams.get('sortDir') || 'desc'

    const where: any = {}
    if (search) {
      where.OR = [
        { asunto: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (estado) where.estado = estado
    if (prioridad) where.nivelPrioridad = prioridad

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true } },
        agente: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(tickets)
  } catch {
    return NextResponse.json({ error: 'Error al obtener tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.asunto || !data.descripcion || !data.categoriaId) {
      return NextResponse.json({ error: 'Asunto, descripción y categoría son requeridos' }, { status: 400 })
    }

    const categoria = await prisma.categoria.findUnique({
      where: { id: data.categoriaId },
      include: { colaDefault: true },
    })
    if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

    const count = await prisma.ticket.count()
    const codigo = `TK-${String(count + 1).padStart(5, '0')}`

    const sla = await prisma.sla.findFirst({
      where: { categoriaId: data.categoriaId, prioridad: data.nivelPrioridad || 'MEDIA' },
    })

    const ticket = await prisma.ticket.create({
      data: {
        codigo,
        asunto: data.asunto,
        descripcion: data.descripcion,
        estado: 'NUEVO',
        nivelPrioridad: data.nivelPrioridad || 'MEDIA',
        solicitanteId: data.solicitanteId || session.id as string,
        categoriaId: data.categoriaId,
        colaId: categoria.colaDefaultId,
        slaId: sla?.id || null,
        origen: 'WEB',
      },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    })

    await prisma.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: ticket.solicitanteId,
        accion: 'CREACION',
        valorNuevo: 'Ticket creado',
      },
    })

    if (data.adjuntos && Array.isArray(data.adjuntos)) {
      await prisma.adjunto.createMany({
        data: data.adjuntos.map((a: any) => ({
          ticketId: ticket.id,
          nombre: a.nombre,
          tipo: a.tipo,
          url: a.url || '',
          data: a.data,
          tamaño: a.tamaño,
        })),
      })
    }

    await notifyAgentes(ticket.id, 'NUEVO_TICKET', `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`)

    return NextResponse.json(ticket, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 })
  }
}
