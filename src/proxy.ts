import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { hasAnyPermission } from '@/lib/permissions'

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

// Rutas exentas de requerir un permiso específico (solo requieren autenticación).
const EXEMPT_PREFIXES = ['/dashboard/notifications', '/dashboard/profile', '/dashboard/queues']

// Autorización por ruta: cifra cualquiera de los permisos listados da acceso.
// El orden importa: las rutas más específicas deben ir primero.
const ROUTE_PERMISSIONS: [string, string[]][] = [
  ['/dashboard/settings/roles', ['settings.roles.view']],
  ['/dashboard/settings/departments', ['settings.departments.view']],
  ['/dashboard/settings/categories', ['settings.categories.view']],
  ['/dashboard/settings/labels', ['settings.labels.view']],
  ['/dashboard/settings/teams', ['settings.teams.view']],
  ['/dashboard/settings/queues', ['settings.queues.view']],
  ['/dashboard/settings/sla', ['settings.sla.view']],
  ['/dashboard/settings/email', ['settings.email.view']],
  [
    '/dashboard/settings',
    [
      'settings.departments.view',
      'settings.categories.view',
      'settings.labels.view',
      'settings.roles.view',
      'settings.teams.view',
      'settings.queues.view',
      'settings.sla.view',
      'settings.email.view',
    ],
  ],
  ['/dashboard/users', ['users.view']],
  ['/tickets/new', ['tickets.create']],
  ['/tickets', ['tickets.viewAll', 'tickets.viewAssigned', 'tickets.viewOwn']],
  ['/reports', ['reports.view']],
  ['/automations', ['automations.view', 'automations.create', 'automations.edit', 'automations.delete']],
  ['/dashboard', ['dashboard.view']],
]

function requiredPermissions(pathname: string): string[] | null {
  for (const [match, perms] of ROUTE_PERMISSIONS) {
    if (pathname === match || pathname.startsWith(`${match}/`)) return perms
  }
  return null
}

function isExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
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

  if (authenticated && !isExempt(pathname)) {
    const perms = requiredPermissions(pathname)
    if (perms && !hasAnyPermission(payload, perms)) {
      return NextResponse.redirect(new URL(homeFor(payload), request.url))
    }
  }

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL(homeFor(payload), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/tickets/:path*', '/reports/:path*', '/queues/:path*', '/automations/:path*', '/login', '/'],
}