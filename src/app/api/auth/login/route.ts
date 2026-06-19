import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { userName, password } = await request.json()

    // En un sistema real se encriptaría el password y se validaría. 
    // Para simplificar este MVP y según los requerimientos, usaremos login directo con username o correo.
    const user = await prisma.usuario.findFirst({
      where: {
        OR: [
          { userName: userName },
          { correo: userName }
        ]
      },
      include: {
        rol: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    if (user.password) {
      const { compare } = await import('bcryptjs')
      const isValid = await compare(password, user.password)
      if (!isValid) {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
      }
    } else {
      // Si el usuario no tiene contraseña (caso de usuarios migrados o error),
      // temporalmente bloqueamos el acceso o requerimos configuración.
      // Para el MVP, asumimos que todos los usuarios locales DEBEN tener clave.
      if (password !== "") {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
      }
    }

    const payload = {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rolId: user.rolId,
      rolNombre: user.rol.nombre,
      permisos: user.rol.permisos
    }

    const token = await signToken(payload)
    
    const cookieStore = await cookies()
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return NextResponse.json({ user: payload })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
