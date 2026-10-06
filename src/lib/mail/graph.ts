import type { EmailConfig } from './config'
import { extractTicketCode } from './core'

export interface GraphMailInput {
  to: string
  subject: string
  html: string
  headers?: { messageId?: string; inReplyTo?: string; references?: string }
}

/**
 * Envía un correo por Microsoft Graph (`POST /me/sendMail`). Se usa cuando la
 * configuración es OAuth2 porque los tenants corporativos suelen tener SMTP AUTH
 * bloqueado (535 SmtpClientAuthentication). Las cabeceras In-Reply-To/References
 * se envían vía `internetMessageHeaders` para que el hilo de conversación se
 * conserve en Outlook igual que con SMTP.
 */
export async function sendEmailViaGraph(
  config: EmailConfig,
  accessToken: string,
  mail: GraphMailInput,
): Promise<void> {
  const domain = config.fromAddress.split('@')[1] || 'cds-ticket.local'
  const ticketCode = extractTicketCode(mail.subject)
  const wrapIds = (value?: string) =>
    value
      ? value
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => (token.startsWith('<') ? token : `<${token}>`))
          .join(' ')
      : undefined

  const message: Record<string, unknown> = {
    subject: mail.subject,
    body: { contentType: 'HTML', content: mail.html },
    toRecipients: [{ emailAddress: { address: mail.to } }],
  }

  if (ticketCode) {
    const rootMessageId = `<${ticketCode.toLowerCase()}-root@${domain}>`
    const inReplyTo = wrapIds(mail.headers?.inReplyTo) || rootMessageId
    message.internetMessageHeaders = [
      { name: 'In-Reply-To', value: inReplyTo },
      {
        name: 'References',
        value: wrapIds(mail.headers?.references) || [inReplyTo, rootMessageId].filter(Boolean).join(' '),
      },
    ]
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { code?: string; message?: string } }
      | null
    const code = body?.error?.code ? ` ${body.error.code}` : ''
    throw new Error(
      `Microsoft Graph rechazó el envío (${response.status}${code}): ${body?.error?.message || 'sin detalle'}`,
    )
  }
}
