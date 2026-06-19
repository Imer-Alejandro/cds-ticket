import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

// In a real app, this should be an environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'
const key = new TextEncoder().encode(JWT_SECRET)

export async function signToken(payload: any) {
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
  } catch (error) {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) return null
  
  const payload = await verifyToken(token)
  return payload
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}
