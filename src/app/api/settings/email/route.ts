import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { loadEmailConfig, saveEmailConfig } from '@/lib/mail/config'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    const rol = (session as any)?.rolNombre
    if (!session || (rol !== 'Administrador' && rol !== 'Supervisor')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const config = await loadEmailConfig()
    return NextResponse.json(config)
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
    const rol = (session as any)?.rolNombre
    if (!session || (rol !== 'Administrador' && rol !== 'Supervisor')) {
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