import { getPrisma } from './prisma'

export interface EmailConfig {
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
      if (typeof d === 'boolean') (cfg as any)[key] = v === 'true'
      else if (typeof d === 'number') (cfg as any)[key] = parseInt(v, 10) || 0
      else (cfg as any)[key] = v
    }
  }
  return cfg
}
