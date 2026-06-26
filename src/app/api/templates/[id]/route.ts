import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await request.json()
    const template = await prisma.plantillaRespuesta.update({
      where: { id },
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        categoriaId: data.categoriaId || null,
        esGlobal: data.esGlobal,
      },
    })
    return NextResponse.json(template)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    await prisma.plantillaRespuesta.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 })
  }
}
