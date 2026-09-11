import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission, resolvePermission, Permissions } from '@/lib/permissions'

/**
 * Lista de agentes candidatos para asignación de tickets (usuarios cuyo rol
 * puede ver/asignarse tickets). Requiere tickets.assign.
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!hasPermission(session, 'tickets.assign')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        rol: { select: { nombre: true, permisos: true } },
      },
      orderBy: { nombre: 'asc' },
    })

    const agentes = usuarios
      .filter((u) => {
        const permisos = (u.rol?.permisos ?? {}) as Permissions
        return (
          resolvePermission(permisos, 'tickets.viewAssigned') ||
          resolvePermission(permisos, 'tickets.viewAll')
        )
      })
      .map((u) => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        rolNombre: u.rol?.nombre ?? '',
      }))

    return NextResponse.json(agentes)
  } catch {
    return NextResponse.json({ error: 'Error al obtener agentes' }, { status: 500 })
  }
}