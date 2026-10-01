import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { loadEmailConfig, saveEmailConfig } from '@/lib/mail/config'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !hasPermission(session, 'settings.email.view')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const config = await loadEmailConfig()
    delete config.monitorAfter
    const { tenantId, clientId, clientSecret, refreshToken, ...safeConfig } = config
    return NextResponse.json({
      ...safeConfig,
      imapPass: '',
      smtpPass: '',
      oauthConfigured: Boolean(tenantId && clientId && clientSecret),
      hasRefreshToken: Boolean(refreshToken),
    })
  } catch (error) {
    console.error('Error loading email config:', error)
    return NextResponse.json(
      { error: 'Failed to load email configuration' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !hasPermission(session, 'settings.email.edit')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    await saveEmailConfig(body)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving email config:', error)
    return NextResponse.json(
      { error: 'Failed to save email configuration' },
      { status: 500 }
    )
  }
}