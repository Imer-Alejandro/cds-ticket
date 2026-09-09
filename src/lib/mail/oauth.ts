import type { EmailConfig } from './config'

export const MICROSOFT_SCOPES = [
  'offline_access',
  'https://outlook.office365.com/IMAP.AccessAsUser.All',
  'https://outlook.office365.com/SMTP.Send',
].join(' ')

function authority(config: Pick<EmailConfig, 'tenantId'>) {
  return `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId || 'common')}/oauth2/v2.0`
}

export function microsoftRedirectUri(origin: string) {
  const configuredOrigin = process.env.APP_URL?.replace(/\/$/, '') || origin.replace(/\/$/, '')
  return `${configuredOrigin}/api/settings/email/oauth/callback`
}

export function microsoftAuthorizationUrl(config: Pick<EmailConfig, 'tenantId' | 'clientId'>, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES,
    state,
  })
  return `${authority(config)}/authorize?${params.toString()}`
}

async function tokenRequest(config: Pick<EmailConfig, 'tenantId' | 'clientId' | 'clientSecret'>, params: URLSearchParams) {
  const response = await fetch(`${authority(config)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const body = await response.json() as { access_token?: string; refresh_token?: string; error?: string; error_description?: string }
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || 'Microsoft no devolvió un token de acceso')
  }
  return body
}

export async function exchangeMicrosoftCode(config: Pick<EmailConfig, 'tenantId' | 'clientId' | 'clientSecret'>, code: string, redirectUri: string) {
  return tokenRequest(config, new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES,
  }))
}

export async function getMicrosoftAccessToken(config: EmailConfig) {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error('Falta configurar clientId, clientSecret o refreshToken de Microsoft 365')
  }
  const token = await tokenRequest(config, new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    scope: MICROSOFT_SCOPES,
  }))
  return token.access_token
}