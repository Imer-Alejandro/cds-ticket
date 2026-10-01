import prisma from '@/lib/prisma'
import { getMicrosoftOAuthEnvironment, hasMicrosoftOAuthEnvironment } from './env'

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
  checkInterval: 15,
  defaultCategoriaId: '',
}

const KEYS: (keyof EmailConfig)[] = [
  'authMode', 'refreshToken', 'oauthMailbox', 'monitorAfter',
  'enabled', 'imapHost', 'imapPort', 'imapSecure', 'imapUser', 'imapPass',
  'imapFolder', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass',
  'fromAddress', 'fromName', 'checkInterval', 'defaultCategoriaId',
]

export async function loadEmailConfig(): Promise<EmailConfig> {
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

  const legacyCredentialKeys = ['email_tenantId', 'email_clientId', 'email_clientSecret']
  if (
    hasMicrosoftOAuthEnvironment(cfg) &&
    rows.some(row => legacyCredentialKeys.includes(row.clave))
  ) {
    await prisma.configuracion.deleteMany({
      where: { grupo: 'email', clave: { in: legacyCredentialKeys } },
    })
  }
  return cfg
}

export async function saveEmailConfig(cfg: Partial<EmailConfig>) {
  const secretKeys: (keyof EmailConfig)[] = ['imapPass', 'smtpPass', 'refreshToken']
  const ops = KEYS.filter(k => k in cfg && !(secretKeys.includes(k) && cfg[k] === '')).map(k => ({
    clave: `email_${k}`,
    valor: String(cfg[k]),
    grupo: 'email',
  }))
  for (const op of ops) {
    await prisma.configuracion.upsert({
      where: { clave: op.clave },
      update: { valor: op.valor },
      create: op,
    })
  }
}
