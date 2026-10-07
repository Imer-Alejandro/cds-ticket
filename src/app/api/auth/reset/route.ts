import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { consumePasswordResetToken, validateNewPassword } from '@/lib/password-reset'

/**
 * Cambia la contraseña usando el enlace único de recuperación.
 * El token se consume en el mismo intento: solo sirve una vez.
 */
export async function POST(request: Request) {
  try {
    const { token, password } = await request.json().catch(() => ({}))

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'El enlace de recuperación no es válido o ha expirado' }, { status: 400 })
    }

    const passwordError = validateNewPassword(String(password ?? ''))
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const usuarioId = await consumePasswordResetToken(token)
    if (!usuarioId) {
      return NextResponse.json({ error: 'El enlace de recuperación no es válido o ha expirado' }, { status: 400 })
    }

    const { hash } = await import('bcryptjs')
    const hashed = await hash(String(password), 10)
    await prisma.usuario.update({ where: { id: usuarioId }, data: { password: hashed } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
