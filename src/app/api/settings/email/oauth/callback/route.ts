import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { loadEmailConfig, saveEmailConfig } from '@/lib/mail/config'
import { exchangeMicrosoftCode, microsoftRedirectUri, verifyMicrosoftMailbox } from '@/lib/mail/oauth'

function settingsRedirect(request: NextRequest, result: 'connected' | 'error', message?: string) {
  const url = new URL('/dashboard/settings/email', request.url)
  url.searchParams.set('oauth', result)
  if (message) url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session, 'settings.email.edit')) {
    return settingsRedirect(request, 'error', 'No autorizado')
  }

  const state = request.nextUrl.searchParams.get('state')
  const storedState = request.cookies.get('email_oauth_state')?.value
  const nonce = request.cookies.get('email_oauth_nonce')?.value
  if (!state || !storedState || state !== storedState || !nonce) {
    return settingsRedirect(request, 'error', 'Estado OAuth inválido o expirado')
  }

  const oauthError = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error')
  const code = request.nextUrl.searchParams.get('code')
  if (oauthError || !code) return settingsRedirect(request, 'error', oauthError || 'Microsoft no devolvió un código')

  try {
    const config = await loadEmailConfig()
    const tokens = await exchangeMicrosoftCode(
      config,
      code,
      microsoftRedirectUri(new URL(request.url).origin),
    )
    if (!tokens.refresh_token) throw new Error('Microsoft no devolvió refresh_token; revisa el permiso offline_access')
    if (!tokens.id_token) throw new Error('Microsoft no devolvió la identidad de la cuenta autorizada')
    const oauthMailbox = await verifyMicrosoftMailbox(tokens.id_token, config, config.imapUser, nonce)
    const sameMailbox = config.oauthMailbox.trim().toLowerCase() === oauthMailbox
    await saveEmailConfig({
      authMode: 'oauth2',
      refreshToken: tokens.refresh_token,
      oauthMailbox,
      monitorAfter: sameMailbox && config.monitorAfter ? config.monitorAfter : new Date().toISOString(),
    })
    const response = settingsRedirect(request, 'connected')
    response.cookies.delete('email_oauth_state')
    response.cookies.delete('email_oauth_nonce')
    return response
  } catch (error) {
    return settingsRedirect(request, 'error', error instanceof Error ? error.message : 'No se pudo conectar Microsoft 365')
  }
}