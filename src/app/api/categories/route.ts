import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        colaDefault: true,
        _count: {
          select: { tickets: true }
        }
      }
    })

    return NextResponse.json(categorias)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
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
    
    if (!data.nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const newCategoria = await prisma.categoria.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null
      }
    })

    return NextResponse.json(newCategoria, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}
