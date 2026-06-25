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

    await prisma.equipoUsuario.deleteMany({ where: { equipoId: id } })

    const updated = await prisma.equipo.update({
      where: { id },
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

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    await prisma.equipoUsuario.deleteMany({ where: { equipoId: id } })
    await prisma.cola.updateMany({ where: { equipoId: id }, data: { equipoId: undefined } })

    try {
      await prisma.equipo.delete({ where: { id } })
    } catch {
      return NextResponse.json({ error: 'No se puede eliminar el equipo' }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 })
  }
}
