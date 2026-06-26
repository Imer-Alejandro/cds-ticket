import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo no enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    return NextResponse.json({
      nombre: file.name,
      tipo: file.type,
      tamaño: file.size,
      data: base64,
      url: dataUrl,
    })
  } catch {
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
