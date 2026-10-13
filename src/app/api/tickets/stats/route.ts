import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ESTADOS_ACTIVOS } from '@/lib/tickets'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const userId = session.id as string
    // Solo cuentan tickets activos: Eliminado, Resuelto y Cerrado no se reflejan.
    const [misActivos, noAsignados, nuevos] = await Promise.all([
      prisma.ticket.count({
        where: {
          agenteId: userId,
          estado: { in: ESTADOS_ACTIVOS },
        },
      }),
      prisma.ticket.count({ where: { agenteId: null, estado: { in: ESTADOS_ACTIVOS } } }),
      prisma.ticket.count({ where: { estado: 'NUEVO' } }),
    ])

    return NextResponse.json({ misActivos, noAsignados, nuevos })
  } catch {
    return NextResponse.json({ error: 'Error al obtener estadísticas de tickets' }, { status: 500 })
  }
}