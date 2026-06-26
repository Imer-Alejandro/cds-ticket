import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: session.id as string },
      orderBy: { fecha: 'desc' },
      take: 50,
      include: {
        ticket: { select: { codigo: true, asunto: true } },
      },
    })
    const noLeidas = await prisma.notificacion.count({
      where: { usuarioId: session.id as string, leido: false },
    })
    return NextResponse.json({ notificaciones, noLeidas })
  } catch {
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (data.marcarTodas) {
      await prisma.notificacion.updateMany({
        where: { usuarioId: session.id as string, leido: false },
        data: { leido: true },
      })
    } else if (data.id) {
      await prisma.notificacion.update({
        where: { id: data.id },
        data: { leido: true },
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 })
  }
}
