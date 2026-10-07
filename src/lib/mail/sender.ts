import nodemailer from 'nodemailer'
import { loadEmailConfig, saveEmailConfig } from './config'
import { createOutbox, type EmailAttachment, type EmailMessage, type EmailOutboxInstance } from './outbox'
import { extractTicketCode } from './core'
import { getMicrosoftGraphAccessToken } from './oauth'
import { sendEmailViaGraph } from './graph'

let outbox: EmailOutboxInstance | null = null

/**
 * Envía un mensaje real usando la configuración guardada en BD.
 * OAuth2 → Microsoft Graph (el tenant bloquea SMTP AUTH); password → SMTP.
 * Incluye cabeceras de hilo de conversación (In-Reply-To, References, Message-ID)
 * y adjuntos opcionales (base64).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: { messageId?: string; inReplyTo?: string; references?: string },
  attachments?: EmailAttachment[],
): Promise<void> {
  const config = await loadEmailConfig()
  if (!config.fromAddress) {
    console.warn('[Mail] Email no enviado: falta fromAddress en Ajustes > Correo')
    return
  }

  if (config.authMode === 'oauth2') {
    const accessToken = await getMicrosoftGraphAccessToken(config, async (refreshToken) => { await saveEmailConfig({ refreshToken }) })
    await sendEmailViaGraph(accessToken, { to, subject, html, headers, attachments })
    return
  }

  if (!config.smtpHost) {
    console.warn('[Mail] Email no enviado: SMTP sin configurar (falta smtpHost en Ajustes > Correo)')
    return
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  })

  const domain = config.fromAddress.split('@')[1] || 'cds-ticket.local'
  const ticketCode = extractTicketCode(subject)

  const mailOptions: any = {
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject,
    html,
  }

  if (attachments?.length) {
    mailOptions.attachments = attachments.map((a) => ({
      filename: a.nombre,
      content: Buffer.from(a.data, 'base64'),
      contentType: a.tipo,
    }))
  }

  if (ticketCode) {
    const rootMessageId = `<${ticketCode.toLowerCase()}-root@${domain}>`
    // Normaliza a formato <id> sin romper cadenas References (space-separated).
    const wrapIds = (value?: string) =>
      value
        ? value
            .split(/\s+/)
            .filter(Boolean)
            .map((token) => (token.startsWith('<') ? token : `<${token}>`))
            .join(' ')
        : undefined
    const inReplyTo = wrapIds(headers?.inReplyTo) || rootMessageId
    mailOptions.messageId = headers?.messageId || `<${ticketCode.toLowerCase()}-${Date.now()}@${domain}>`
    mailOptions.headers = {
      'In-Reply-To': inReplyTo,
      // References = la cadena de la rama (incluye al padre); si no hay cadena,
      // se reconstruye con el padre y la raíz sintética del ticket.
      'References': wrapIds(headers?.references) || [inReplyTo, rootMessageId].filter(Boolean).join(' '),
    }
  }

  await transporter.sendMail(mailOptions)
}

/**
 * Interfaz pública: encola el correo en la cola global con reintentos.
 * Utiliza el transportador real por defecto (cargando config SMTP desde BD).
 */
export function enqueueEmail(msg: EmailMessage): void {
  if (!outbox) {
    outbox = createOutbox({
      send: async ({ to, subject, html, inReplyTo, references, attachments }) => {
        await sendEmail(to, subject, html, {
          inReplyTo: inReplyTo ?? undefined,
          references: references ?? undefined,
        }, attachments)
      },
      enabled: () => true,
    })
  }
  outbox.enqueue(msg)
}

/** Para tests: permite crear una cola con transportador simulado. */
export function createTestOutbox(send: (m: EmailMessage) => Promise<void>): EmailOutboxInstance {
  return createOutbox({ send, enabled: () => true, retryDelayMs: 1 })
}