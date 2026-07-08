import { NextRequest, NextResponse } from 'next/server'
import { loadEmailConfig, saveEmailConfig } from '@/lib/mail/config'

export async function GET(req: NextRequest) {
  try {
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
