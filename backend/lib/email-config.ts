import { getPrisma } from './prisma'
import { getMicrosoftOAuthEnvironment } from '../../src/lib/mail/env'

export interface EmailConfig {
  authMode: 'password' | 'oauth2'
  tenantId: string
  clientId: string
  clientSecret: string
  refreshToken: string
  oauthMailbox: string
  monitorAfter: string
  enabled: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  imapPass: string
  imapFolder: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  fromAddress: string
  fromName: string
  checkInterval: number
  defaultCategoriaId: string
}

const DEFAULTS: EmailConfig = {
  authMode: 'password',
  tenantId: '',
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  oauthMailbox: '',
  monitorAfter: '',
  enabled: false,
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapPass: '',
  imapFolder: 'INBOX',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  fromAddress: '',
  fromName: 'Help Desk IT',
  checkInterval: 10,
  defaultCategoriaId: '',
}

const KEYS: (keyof EmailConfig)[] = [
  'authMode', 'refreshToken', 'oauthMailbox', 'monitorAfter',
  'enabled', 'imapHost', 'imapPort', 'imapSecure', 'imapUser', 'imapPass',
  'imapFolder', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass',
  'fromAddress', 'fromName', 'checkInterval', 'defaultCategoriaId',
]

export async function loadEmailConfig(): Promise<EmailConfig> {
  const prisma = getPrisma()
  const rows = await prisma.configuracion.findMany({
    where: { grupo: 'email' },
  })
  const map = new Map(rows.map(r => [r.clave, r.valor]))
  const cfg = { ...DEFAULTS }
  for (const key of KEYS) {
    const v = map.get(`email_${key}`)
    if (v !== undefined) {
      const d = DEFAULTS[key]
      const value = typeof d === 'boolean'
        ? v === 'true'
        : typeof d === 'number'
          ? parseInt(v, 10) || 0
          : v
      Object.assign(cfg, { [key]: value })
    }
  }
  Object.assign(cfg, getMicrosoftOAuthEnvironment())
  return cfg
}
