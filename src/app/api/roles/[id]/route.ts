import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission, sanitizePermissions } from '@/lib/permissions'
import { invalidateRolePermissions } from '@/lib/role-permissions'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'settings.roles.edit')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    const data = await request.json()

    const updated = await prisma.rol.update({
      where: { id },
      data: {
        nombre: data.nombre,
        ...(data.permisos !== undefined ? { permisos: sanitizePermissions(data.permisos) } : {}),
      },
    })

    invalidateRolePermissions(id)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'settings.roles.delete')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const { id } = await params
    const userCount = await prisma.usuario.count({ where: { rolId: id } })
    if (userCount > 0) {
      return NextResponse.json({ error: 'No se puede eliminar un rol con usuarios asignados' }, { status: 409 })
    }

    await prisma.rol.delete({ where: { id } })
    invalidateRolePermissions(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 })
  }
}