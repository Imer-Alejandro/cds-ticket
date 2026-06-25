import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const usuarios = await prisma.usuario.findMany({
      orderBy: { fechaRegistro: 'desc' },
      include: {
        rol: { select: { id: true, nombre: true } },
        departamento: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(usuarios)
  } catch {
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rolNombre !== 'Administrador') return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

    const data = await request.json()
    const { hash } = await import('bcryptjs')
    const hashedPassword = await hash(data.password || 'changeme123', 10)

    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        correo: data.correo,
        userName: data.userName,
        password: hashedPassword,
        telefono: data.telefono || null,
        departamentoId: data.departamentoId || null,
        rolId: data.rolId,
      },
      include: {
        rol: { select: { id: true, nombre: true } },
        departamento: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(usuario, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'El correo o nombre de usuario ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
