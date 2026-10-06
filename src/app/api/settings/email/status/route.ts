import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { loadEmailConfig } from '@/lib/mail/config'
import type { MailCheckStatus } from '@/lib/mail/check'

/**
 * Estado de la última revisión de bandeja del listener (grabado en BD para
 * que sea visible aunque el listener corra en el proceso del backend).
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session || !hasPermission(session, 'settings.email.view')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [row, config] = await Promise.all([
      prisma.configuracion.findUnique({ where: { clave: 'email_lastStatus' } }),
      loadEmailConfig(),
    ])

    let last: MailCheckStatus | null = null
    if (row?.valor) {
      try {
        last = JSON.parse(row.valor) as MailCheckStatus
      } catch {
        last = null
      }
    }

    const interval = Math.max(config.checkInterval || 15, 5)
    const ageMs = last?.at ? Date.now() - Date.parse(last.at) : null
    const stale = ageMs === null ? true : ageMs > Math.max(interval * 3, 120) * 1000

    return NextResponse.json({
      last,
      stale,
      ageMs,
      interval,
      enabled: config.enabled,
      authMode: config.authMode,
      oauthMailbox: config.oauthMailbox,
      hasRefreshToken: Boolean(config.refreshToken),
      monitorAfter: config.monitorAfter || null,
    })
  } catch (error) {
    console.error('Error loading email status:', error)
    return NextResponse.json(
      { error: 'Failed to load email status' },
      { status: 500 }
    )
  }
}
