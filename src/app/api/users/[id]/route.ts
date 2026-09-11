import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

type UpdateData = {
  nombre: string; apellido: string; correo: string; userName: string
  telefono: string | null; departamentoId: string | null; rolId: string
  password?: string
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        rol: { select: { id: true, nombre: true } },
        departamento: { select: { id: true, nombre: true } },
      },
    })

    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    return NextResponse.json(usuario)
  } catch {
    return NextResponse.json({ error: 'Error al obtener usuario' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'users.edit')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    const data = await request.json()

    const updateData: UpdateData = {
      nombre: data.nombre,
      apellido: data.apellido,
      correo: data.correo,
      userName: data.userName,
      telefono: data.telefono || null,
      departamentoId: data.departamentoId || null,
      rolId: data.rolId,
    }

    if (data.password) {
      const { hash } = await import('bcryptjs')
      updateData.password = await hash(data.password, 10)
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: updateData,
      include: {
        rol: { select: { id: true, nombre: true } },
        departamento: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(usuario)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'El correo o nombre de usuario ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'users.delete')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    // Soft delete: se desactiva el usuario para no romper el historial de tickets,
    // comentarios y logs que referencian su id.
    await prisma.usuario.update({ where: { id }, data: { activo: false } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
