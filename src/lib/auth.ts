import { jwtVerify, SignJWT } from 'jose'
import { cookies, headers } from 'next/headers'
import { freshRolePermissions } from '@/lib/role-permissions'
import { JWTPayload } from 'jose'
import { Permissions } from '@/lib/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'
const key = new TextEncoder().encode(JWT_SECRET)

// Token corto: los permisos se re-resuelven por request contra la BD (con cache).
export async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
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
  const payload = await verifyToken(token)
  if (!payload) return null
  await refreshPermissions(payload)
  return payload
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
  const payload = await verifyToken(token)
  if (!payload) return null
  await refreshPermissions(payload)
  return payload
}

/**
 * Propagación de permisos sin re-login: sobrescribe el snapshot del token
 * con los permisos frescos del rol (BD, con cache). Si la BD falla, se
 * mantienen los permisos del token (degradación segura).
 */
async function refreshPermissions(payload: JWTPayload) {
  const rolId = payload.rolId as string | undefined
  if (!rolId) return
  try {
    const permisos = await freshRolePermissions(rolId)
    if (permisos) payload.permisos = permisos as Permissions
  } catch {
    // La cache/DB no está disponible: seguir con el snapshot del token.
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}
