import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { loadEmailConfig } from '@/lib/mail/config'
import { microsoftAuthorizationUrl, microsoftRedirectUri } from '@/lib/mail/oauth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session, 'settings.email.edit')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const config = await loadEmailConfig()
  if (config.authMode !== 'oauth2' || !config.clientId) {
    return NextResponse.json({ error: 'Configura OAuth2, clientId y tenantId antes de conectar' }, { status: 400 })
  }

  const state = randomUUID()
  const redirectUri = microsoftRedirectUri(new URL(request.url).origin)
  const response = NextResponse.redirect(microsoftAuthorizationUrl(config, redirectUri, state))
  response.cookies.set('email_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/api/settings/email/oauth',
  })
  return response
}