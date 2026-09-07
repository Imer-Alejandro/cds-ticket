import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const userId = session.id as string
    const [misActivos, noAsignados, nuevos] = await Promise.all([
      prisma.ticket.count({
        where: {
          agenteId: userId,
          estado: { notIn: ['CERRADO', 'RESUELTO'] },
        },
      }),
      prisma.ticket.count({ where: { agenteId: null } }),
      prisma.ticket.count({ where: { estado: 'NUEVO' } }),
    ])

    return NextResponse.json({ misActivos, noAsignados, nuevos })
  } catch {
    return NextResponse.json({ error: 'Error al obtener estadísticas de tickets' }, { status: 500 })
  }
}