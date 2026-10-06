import { NextRequest, NextResponse } from 'next/server'
import { processIncomingEmails } from '@/lib/mail/listener'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    // Verificar que sea una solicitud autorizada (quien configura el correo o cron)
    const session = await getSession()
    const authHeader = req.headers.get('authorization')
    const isCronSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`
    const isEquipo = session ? hasPermission(session, 'settings.email.edit') : false

    if (!isCronSecret && !isEquipo) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Procesar correos
    const status = await processIncomingEmails()

    return NextResponse.json(
      {
        success: status.ok,
        message: status.ok ? 'Email processing completed' : 'Email processing failed',
        status,
      },
      { status: status.ok ? 200 : 503 }
    )
  } catch (error) {
    console.error('Error in email processing endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    )
  }
}
