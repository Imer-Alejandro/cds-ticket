import nodemailer from 'nodemailer'
import { loadEmailConfig } from './config'
import { createOutbox, type EmailMessage, type EmailOutboxInstance } from './outbox'

let outbox: EmailOutboxInstance | null = null

function getTransporter() {
  return nodemailer.createTransport({})
}

/**
 * Envía un mensaje real por SMTP usando la configuración guardada en BD.
 * Si la configuración SMTP no está completa, no envía nada y no falla.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const config = await loadEmailConfig()
  if (!config.smtpHost || !config.fromAddress) return

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  })

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject,
    html,
  })
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