import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return false
  const payload = await verifyToken(token)
  return payload !== null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authenticated = await isAuthenticated(request)

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(authenticated ? '/dashboard' : '/login', request.url)
    )
  }

  if (pathname.startsWith('/dashboard') && !authenticated) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
}
