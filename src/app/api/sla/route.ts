import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const slas = await prisma.sla.findMany({
      orderBy: { categoria: { nombre: 'asc' } },
      include: { categoria: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(slas)
  } catch {
    return NextResponse.json({ error: 'Error al obtener SLAs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const data = await request.json()
    if (!data.categoriaId || !data.prioridad || !data.minutosRespuesta || !data.minutosResolucion) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    const sla = await prisma.sla.create({ data })

    return NextResponse.json(sla, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear SLA' }, { status: 500 })
  }
}
