import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const etiquetas = await prisma.etiqueta.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })

    return NextResponse.json(etiquetas)
  } catch {
    return NextResponse.json({ error: 'Error al obtener etiquetas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.rolNombre !== 'Administrador') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const data = await request.json()
    
    if (!data.nombre || !data.color) {
      return NextResponse.json({ error: 'El nombre y color son requeridos' }, { status: 400 })
    }

    const newEtiqueta = await prisma.etiqueta.create({
      data: {
        nombre: data.nombre,
        color: data.color
      }
    })

    return NextResponse.json(newEtiqueta, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear etiqueta' }, { status: 500 })
  }
}
