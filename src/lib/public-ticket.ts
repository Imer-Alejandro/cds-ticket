import { SignJWT, jwtVerify } from 'jose'

// El enlace público de seguimiento usa el mismo secreto del JWT de sesión.
// Es un JWT independiente (audience propio) que NO requiere login para verificarlo.
const PUBLIC_SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'
const key = new TextEncoder().encode(PUBLIC_SECRET)
const AUDIENCE = 'ticket-public'

export async function createPublicTicketToken(ticketId: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ticketId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(key)
}

export async function verifyPublicTicketToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { audience: AUDIENCE })
    return payload.sub || null
  } catch {
    return null
  }
}

/**
 * Genera la URL pública de seguimiento para un ticket.
 * Prefiere APP_URL (para cron/contextos sin request) y cae al origin del request.
 */
export async function publicTicketUrl(origin: string | URL, ticketId: string): Promise<string> {
  const base = process.env.APP_URL?.replace(/\/$/, '') || new URL(String(origin)).origin
  const token = await createPublicTicketToken(ticketId)
  return `${base}/seguimiento/${token}`
}