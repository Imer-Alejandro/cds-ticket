import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'settings.departments.edit')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    const data = await request.json()

    const updated = await prisma.departamento.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar departamento' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'settings.departments.delete')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    await prisma.departamento.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar departamento' }, { status: 500 })
  }
}
