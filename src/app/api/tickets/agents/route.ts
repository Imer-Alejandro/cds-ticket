import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const puedeVerTodo = hasPermission(session, 'tickets.viewAll')
    const puedeVerAsignados = hasPermission(session, 'tickets.viewAssigned')
    const puedeVerPropios = hasPermission(session, 'tickets.viewOwn')
    if (!puedeVerTodo && !puedeVerAsignados && !puedeVerPropios) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const where: Prisma.TicketWhereInput = {
      estado: { not: 'ELIMINADO' },
      agenteId: { not: null },
    }
    if (!puedeVerTodo) {
      if (puedeVerAsignados) {
        const asignadoOR: Prisma.TicketWhereInput[] = [{ agenteId: session.id as string }]
        if (puedeVerPropios) asignadoOR.push({ solicitanteId: session.id as string })
        where.OR = asignadoOR
      } else if (puedeVerPropios) {
        where.solicitanteId = session.id as string
      }
    }

    const tickets = await prisma.ticket.findMany({
      where,
      distinct: ['agenteId'],
      select: {
        agente: { select: { id: true, nombre: true, apellido: true } },
      },
    })
    const agentes = tickets
      .flatMap(ticket => ticket.agente ? [ticket.agente] : [])
      .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`))

    return NextResponse.json(agentes)
  } catch {
    return NextResponse.json({ error: 'Error al obtener agentes asignados' }, { status: 500 })
  }
}
