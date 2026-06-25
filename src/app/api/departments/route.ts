import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const departamentos = await prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { usuarios: true }
        }
      }
    })

    return NextResponse.json(departamentos)
  } catch {
    return NextResponse.json({ error: 'Error al obtener departamentos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Validación básica de rol: Solo Admin o Supervisor debería crear departamentos
    if (session.rolNombre !== 'Administrador' && session.rolNombre !== 'Supervisor') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const data = await request.json()
    
    if (!data.nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const newDept = await prisma.departamento.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null
      }
    })

    return NextResponse.json(newDept, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear departamento' }, { status: 500 })
  }
}
