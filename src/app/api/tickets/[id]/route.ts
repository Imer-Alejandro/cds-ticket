import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createNotification, notifyAgentes } from '@/lib/notifications'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, correo: true } },
        agente: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
        cola: { select: { id: true, nombre: true, equipo: { select: { nombre: true } } } },
        sla: true,
        comentarios: {
          orderBy: { fecha: 'asc' },
          include: {
            usuario: { select: { id: true, nombre: true, apellido: true } },
            adjuntos: true,
          },
        },
        adjuntos: { where: { comentarioId: null } },
        logs: { orderBy: { fecha: 'asc' }, include: { usuario: { select: { nombre: true, apellido: true } } } },
        etiquetas: { include: { etiqueta: true } },
      },
    })

    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    return NextResponse.json(ticket)
  } catch {
    return NextResponse.json({ error: 'Error al obtener ticket' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await request.json()
    const ticket = await prisma.ticket.findUnique({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const updateData: any = {}
    const logs: { accion: string; valorAnterior?: string; valorNuevo?: string }[] = []

    if (data.estado && data.estado !== ticket.estado) {
      updateData.estado = data.estado
      logs.push({ accion: 'CAMBIO_ESTADO', valorAnterior: ticket.estado, valorNuevo: data.estado })
      if (data.estado === 'RESUELTO') updateData.fechaResolucion = new Date()
      if (data.estado === 'CERRADO') updateData.fechaCierre = new Date()
    }
    if (data.agenteId && data.agenteId !== ticket.agenteId) {
      updateData.agenteId = data.agenteId
      logs.push({ accion: 'ASIGNACION', valorAnterior: ticket.agenteId || 'Sin asignar', valorNuevo: data.agenteId })
    }
    if (data.nivelPrioridad && data.nivelPrioridad !== ticket.nivelPrioridad) {
      updateData.nivelPrioridad = data.nivelPrioridad
      logs.push({ accion: 'CAMBIO_PRIORIDAD', valorAnterior: ticket.nivelPrioridad, valorNuevo: data.nivelPrioridad })
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true } },
        agente: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    })

    for (const log of logs) {
      await prisma.logTicket.create({
        data: {
          ticketId: id,
          usuarioId: session.id as string,
          accion: log.accion,
          valorAnterior: log.valorAnterior,
          valorNuevo: log.valorNuevo,
        },
      })
    }

    if (data.estado) {
      await createNotification(ticket.solicitanteId, 'CAMBIO_ESTADO', `Ticket ${ticket.codigo} cambió a ${data.estado.replace(/_/g, ' ')}`, id)
    }
    if (data.agenteId && data.agenteId !== ticket.agenteId) {
      await createNotification(data.agenteId, 'ASIGNACION', `Has sido asignado al ticket ${ticket.codigo}: ${ticket.asunto}`, id)
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar ticket' }, { status: 500 })
  }
}
