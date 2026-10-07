import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createPasswordResetToken, passwordResetUrl } from '@/lib/password-reset'
import { resetPasswordEmail } from '@/lib/mail/templates'
import { enqueueEmail } from '@/lib/mail/sender'

/**
 * Solicita el enlace de recuperación. Responde siempre lo mismo para no
 * revelar si el correo existe en el sistema.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json().catch(() => ({ email: '' }))
    const correo = String(email ?? '').trim()
    if (!correo) {
      return NextResponse.json({ error: 'Ingresa tu correo electrónico' }, { status: 400 })
    }

    const user = await prisma.usuario.findUnique({ where: { correo } })
    if (user && user.activo !== false) {
      const token = await createPasswordResetToken(user.id)
      const url = passwordResetUrl(request.url, token)
      const nombre = `${user.nombre} ${user.apellido}`.trim() || user.nombre
      const { subject, html } = resetPasswordEmail(nombre, url)
      enqueueEmail({ to: user.correo, subject, html })
    }

    return NextResponse.json({
      ok: true,
      message: 'Si el correo existe en el sistema, recibirás un enlace para restablecer tu contraseña.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
