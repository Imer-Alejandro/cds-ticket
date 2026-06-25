import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    const data = await request.json()

    const updated = await prisma.etiqueta.update({
      where: { id },
      data: {
        nombre: data.nombre,
        color: data.color,
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar etiqueta' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    await prisma.etiqueta.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar etiqueta' }, { status: 500 })
  }
}
