import type { EmailConfig } from './config'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send',
].join(' ')

const microsoftJwks = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys')
)

function authority(config: Pick<EmailConfig, 'tenantId'>) {
  return `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId || 'common')}/oauth2/v2.0`
}

export function microsoftRedirectUri(origin: string) {
  const requestOrigin = origin.replace(/\/$/, '')
  const configuredOrigin = process.env.NODE_ENV === 'production'
    ? process.env.APP_URL?.replace(/\/$/, '') || requestOrigin
    : requestOrigin
  return `${configuredOrigin}/api/settings/email/oauth/callback`
}

export function microsoftAuthorizationUrl(
  config: Pick<EmailConfig, 'tenantId' | 'clientId'>,
  redirectUri: string,
  state: string,
  nonce: string,
  loginHint: string,
) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES,
    state,
    nonce,
    login_hint: loginHint,
    prompt: 'select_account',
  })
  return `${authority(config)}/authorize?${params.toString()}`
}

async function tokenRequest(config: Pick<EmailConfig, 'tenantId' | 'clientId' | 'clientSecret'>, params: URLSearchParams) {
  const response = await fetch(`${authority(config)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const body = await response.json() as { access_token?: string; refresh_token?: string; id_token?: string; error?: string; error_description?: string }
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

export async function verifyMicrosoftMailbox(
  idToken: string,
  config: Pick<EmailConfig, 'tenantId' | 'clientId'>,
  expectedMailbox: string,
  nonce: string,
) {
  const { payload } = await jwtVerify(idToken, microsoftJwks, {
    audience: config.clientId,
  })
  if (payload.nonce !== nonce) throw new Error('El nonce de la autorización Microsoft no coincide')

  const tenantId = String(payload.tid || '').toLowerCase()
  const issuer = String(payload.iss || '').toLowerCase()
  if (
    !tenantId ||
    tenantId !== config.tenantId.toLowerCase() ||
    issuer !== `https://login.microsoftonline.com/${tenantId}/v2.0`
  ) {
    throw new Error('La cuenta autorizada no pertenece al tenant configurado en MICROSOFT_TENANT_ID')
  }

  const mailboxClaims = [payload.preferred_username, payload.email, payload.upn]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().toLowerCase())
  if (!mailboxClaims.includes(expectedMailbox.trim().toLowerCase())) {
    throw new Error('Autoriza la misma cuenta principal que está configurada en Usuario IMAP')
  }

  return expectedMailbox.trim().toLowerCase()
}

/**
 * Intercambia el refresh token por un access token. Microsoft puede ROTAR el
 * refresh token en cada uso: si llega uno nuevo se persiste vía
 * `onRefreshToken` para que la siguiente revisión no falle en silencio.
 */
export async function getMicrosoftAccessToken(
  config: EmailConfig,
  onRefreshToken?: (refreshToken: string) => Promise<void>,
) {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error('Configura MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET, y vuelve a conectar Microsoft 365')
  }
  const token = await tokenRequest(config, new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    scope: MICROSOFT_SCOPES,
  }))
  if (token.refresh_token && token.refresh_token !== config.refreshToken && onRefreshToken) {
    try {
      await onRefreshToken(token.refresh_token)
    } catch {
      // No fallar la revisión por no poder persistir el token rotado;
      // el siguiente ciclo reintentará con el refresh token guardado.
    }
  }
  return token.access_token
}