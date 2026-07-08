import { NextRequest, NextResponse } from 'next/server'
import { processIncomingEmails } from '@/lib/mail/listener'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // Verificar que sea una solicitud autorizada (admin o cron)
    const session = await getSession()
    const authHeader = req.headers.get('authorization')
    const isCronSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isCronSecret && !session?.esAdmin) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Procesar correos
    await processIncomingEmails()

    return NextResponse.json({
      success: true,
      message: 'Email processing completed',
    })
  } catch (error) {
    console.error('Error in email processing endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    )
  }
}
