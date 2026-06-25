import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const colas = await prisma.cola.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        equipo: { select: { id: true, nombre: true } },
        _count: { select: { tickets: true, categorias: true } },
      },
    })

    return NextResponse.json(colas)
  } catch {
    return NextResponse.json({ error: 'Error al obtener colas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const data = await request.json()
    if (!data.nombre || !data.equipoId) {
      return NextResponse.json({ error: 'Nombre y equipo son requeridos' }, { status: 400 })
    }

    const cola = await prisma.cola.create({
      data: { nombre: data.nombre, equipoId: data.equipoId },
      include: { equipo: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(cola, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear cola' }, { status: 500 })
  }
}
