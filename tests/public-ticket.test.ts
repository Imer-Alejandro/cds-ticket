import { describe, it, expect } from 'vitest'
import { createPublicTicketToken, verifyPublicTicketToken, publicTicketUrl } from '../src/lib/public-ticket'

describe('public ticket token', () => {
  it('round-trip devuelve el id del ticket', async () => {
    const token = await createPublicTicketToken('ticket-123')
    expect(await verifyPublicTicketToken(token)).toBe('ticket-123')
  })

  it('rechaza tokens inválidos', async () => {
    expect(await verifyPublicTicketToken('no-es-un-token')).toBeNull()
    expect(await verifyPublicTicketToken('')).toBeNull()
  })

  it('rechaza tokens de otra audiencia/uso', async () => {
    const { SignJWT } = await import('jose')
    const key = new TextEncoder().encode(process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('ticket-123')
      .setAudience('otra-audiencia')
      .setExpirationTime('1h')
      .sign(key)
    expect(await verifyPublicTicketToken(token)).toBeNull()
  })

  it('publicTicketUrl genera URL con /seguimiento y token válido', async () => {
    const url = await publicTicketUrl('http://localhost:3000', 'ticket-123')
    expect(url).toMatch(/^http:\/\/localhost:3000\/seguimiento\/.+/)
    const token = url.split('/seguimiento/')[1]
    expect(await verifyPublicTicketToken(token)).toBe('ticket-123')
  })
})