import nodemailer from 'nodemailer'
import { loadEmailConfig } from './config'

export async function sendEmail(to: string, subject: string, html: string) {
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
