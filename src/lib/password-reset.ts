import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import prisma from '@/lib/prisma'

// Mismo secreto de sesión (patrón de public-ticket.ts): JWT independiente con
// audience propio, verificable sin login.
const SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'
const key = new TextEncoder().encode(SECRET)
const AUDIENCE = 'password-reset'

/** Vigencia del enlace de recuperación. */
export const PASSWORD_RESET_TTL = '60m'
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

function markerKey(usuarioId: string): string {
  return `password_reset:${usuarioId}`
}

/**
 * Crea un enlace de recuperación de un solo uso para el usuario.
 * El `jti` del JWT se guarda en Configuracion: al consumirlo se borra, así que
 * el enlace deja de servir; pedir uno nuevo invalida los anteriores.
 */
export async function createPasswordResetToken(usuarioId: string): Promise<string> {
  const jti = randomUUID()
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuarioId)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(PASSWORD_RESET_TTL)
    .sign(key)

  await prisma.configuracion.upsert({
    where: { clave: markerKey(usuarioId) },
    update: { valor: jti },
    create: { clave: markerKey(usuarioId), valor: jti, grupo: 'password_reset' },
  })
  return token
}

/**
 * Valida el token (firma, expiración y que su jti siga vigente).
 * Devuelve el usuarioId o null si no es válido.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { audience: AUDIENCE })
    const usuarioId = payload.sub
    if (!usuarioId || !payload.jti) return null
    const marker = await prisma.configuracion.findUnique({ where: { clave: markerKey(usuarioId) } })
    if (!marker || marker.valor !== payload.jti) return null
    return usuarioId
  } catch {
    return null
  }
}

/** Valida y consume el enlace (borra el marker): solo puede usarse una vez. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const usuarioId = await verifyPasswordResetToken(token)
  if (!usuarioId) return null
  await prisma.configuracion.deleteMany({ where: { clave: markerKey(usuarioId) } })
  return usuarioId
}

/** URL de la página para elegir la nueva contraseña. */
export function passwordResetUrl(base: string | URL, token: string): string {
  const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(String(base)).origin
  return `${origin}/recuperar/${token}`
}

/** Devuelve el mensaje de error o null si la contraseña es válida (≥ 8). */
export function validateNewPassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres'
  }
  return null
}
