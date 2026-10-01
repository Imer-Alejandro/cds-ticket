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
  if (config.authMode !== 'oauth2') {
    return NextResponse.json({ error: 'Selecciona Microsoft 365 OAuth2 antes de conectar' }, { status: 400 })
  }
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    return NextResponse.json({ error: 'Faltan MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID o MICROSOFT_CLIENT_SECRET en el entorno del servidor' }, { status: 500 })
  }
  if (!config.imapUser) {
    return NextResponse.json({ error: 'Completa Usuario IMAP antes de conectar Microsoft 365' }, { status: 400 })
  }

  const state = randomUUID()
  const nonce = randomUUID()
  const redirectUri = microsoftRedirectUri(new URL(request.url).origin)
  const response = NextResponse.redirect(
    microsoftAuthorizationUrl(config, redirectUri, state, nonce, config.imapUser)
  )
  for (const [name, value] of [['email_oauth_state', state], ['email_oauth_nonce', nonce]]) {
    response.cookies.set(name, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/api/settings/email/oauth',
    })
  }
  return response
}