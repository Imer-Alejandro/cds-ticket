import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

type SessionPayload = Awaited<ReturnType<typeof verifyToken>>

async function getPayload(request: NextRequest): Promise<SessionPayload> {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  return await verifyToken(token)
}

function homeFor(payload: SessionPayload) {
  const permisos = payload?.permisos as { dashboard?: { view?: boolean } } | undefined
  return permisos?.dashboard?.view ? '/dashboard' : '/tickets'
}

const PROTECTED_PREFIXES = ['/dashboard', '/tickets', '/reports', '/queues', '/automations']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const payload = await getPayload(request)
  const authenticated = payload !== null

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(authenticated ? homeFor(payload) : '/login', request.url)
    )
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (isProtected && !authenticated) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL(homeFor(payload), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/tickets/:path*', '/reports/:path*', '/queues/:path*', '/automations/:path*', '/login', '/'],
}
