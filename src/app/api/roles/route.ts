import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const roles = await prisma.rol.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { usuarios: true } } },
    })

    return NextResponse.json(roles)
  } catch {
    return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const data = await request.json()
    if (!data.nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const rol = await prisma.rol.create({
      data: { nombre: data.nombre, permisos: data.permisos || {} },
    })

    return NextResponse.json(rol, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 })
  }
}
