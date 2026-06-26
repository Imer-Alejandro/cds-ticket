import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('categoriaId')

    const where: any = {
      OR: [
        { esGlobal: true },
        { creadaPorId: session.id as string },
      ],
    }
    if (categoriaId) where.categoriaId = categoriaId

    const templates = await prisma.plantillaRespuesta.findMany({
      where,
      orderBy: { titulo: 'asc' },
      include: { creador: { select: { id: true, nombre: true } } },
    })
    return NextResponse.json(templates)
  } catch {
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.titulo || !data.contenido) {
      return NextResponse.json({ error: 'Título y contenido son requeridos' }, { status: 400 })
    }

    const template = await prisma.plantillaRespuesta.create({
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        creadaPorId: session.id as string,
        categoriaId: data.categoriaId || null,
        esGlobal: data.esGlobal || false,
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
  }
}
