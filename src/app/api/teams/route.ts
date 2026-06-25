import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const equipos = await prisma.equipo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        supervisor: { select: { id: true, nombre: true, apellido: true } },
        miembros: {
          include: { usuario: { select: { id: true, nombre: true, apellido: true, correo: true } } },
        },
        colas: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(equipos)
  } catch {
    return NextResponse.json({ error: 'Error al obtener equipos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const data = await request.json()
    if (!data.nombre || !data.supervisorId) {
      return NextResponse.json({ error: 'Nombre y supervisor son requeridos' }, { status: 400 })
    }

    const equipo = await prisma.equipo.create({
      data: {
        nombre: data.nombre,
        supervisorId: data.supervisorId,
        miembros: data.miembros?.length ? {
          create: data.miembros.map((usuarioId: string) => ({ usuarioId })),
        } : undefined,
      },
      include: {
        supervisor: { select: { id: true, nombre: true, apellido: true } },
        miembros: {
          include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
        },
      },
    })

    return NextResponse.json(equipo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear equipo' }, { status: 500 })
  }
}
