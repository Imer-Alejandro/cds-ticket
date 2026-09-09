import nodemailer from 'nodemailer'
import { loadEmailConfig } from './config'
import { createOutbox, type EmailMessage, type EmailOutboxInstance } from './outbox'
import { extractTicketCode } from './core'
import { getMicrosoftAccessToken } from './oauth'

let outbox: EmailOutboxInstance | null = null

/**
 * Envía un mensaje real por SMTP usando la configuración guardada en BD.
 * Incluye cabeceras de hilo de conversación (In-Reply-To, References, Message-ID).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: { messageId?: string; inReplyTo?: string; references?: string }
): Promise<void> {
  const config = await loadEmailConfig()
  if (!config.smtpHost || !config.fromAddress) return

  const accessToken = config.authMode === 'oauth2' ? await getMicrosoftAccessToken(config) : null

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: accessToken
      ? { type: 'OAuth2', user: config.smtpUser || config.fromAddress, accessToken }
      : config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  })

  const domain = config.fromAddress.split('@')[1] || 'cds-ticket.local'
  const ticketCode = extractTicketCode(subject)

  const mailOptions: any = {
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject,
    html,
  }

  if (ticketCode) {
    const rootMessageId = `<${ticketCode.toLowerCase()}-root@${domain}>`
    mailOptions.messageId = headers?.messageId || `<${ticketCode.toLowerCase()}-${Date.now()}@${domain}>`
    mailOptions.headers = {
      'In-Reply-To': headers?.inReplyTo || rootMessageId,
      'References': headers?.references || rootMessageId,
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
      send: async ({ to, subject, html }) => {
        await sendEmail(to, subject, html)
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