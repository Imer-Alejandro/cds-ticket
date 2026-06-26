import { jwtVerify, SignJWT } from 'jose'
import { cookies, headers } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'
const key = new TextEncoder().encode(JWT_SECRET)

export async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key)
    return payload
  } catch {
    return null
  }
}

async function resolveToken() {
  const cookieStore = await cookies()
  let token = cookieStore.get('auth_token')?.value

  if (!token) {
    const headersList = await headers()
    const auth = headersList.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7)
  }

  return token || null
}

export async function getSession() {
  const token = await resolveToken()
  if (!token) return null
  return await verifyToken(token)
}

export async function getSessionFromRequest(request: Request) {
  let token = ''
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) token = auth.slice(7)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/)
    if (match) token = decodeURIComponent(match[1])
  }
  if (!token) return null
  return await verifyToken(token)
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}
