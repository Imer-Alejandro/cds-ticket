import type { ParsedMail } from 'mailparser'
export { slaStatus } from '@/lib/sla'

/**
 * Extrae el código de ticket (TK-#####) que aparece en el asunto de un correo
 * o en sus cabeceras In-Reply-To / References / Message-ID.
 */
export function extractTicketCode(
  subject?: string | null,
  headers?: { inReplyTo?: string | null; references?: string | string[] | null; messageId?: string | null } | null
): string | null {
  if (subject) {
    const m = subject.match(/\b(TK-\d{5})\b/i)
    if (m) return m[1].toUpperCase()
  }

  if (headers) {
    const searchStr = [
      headers.inReplyTo,
      headers.messageId,
      Array.isArray(headers.references) ? headers.references.join(' ') : headers.references,
    ].filter(Boolean).join(' ')

    if (searchStr) {
      const mHeader = searchStr.match(/\b(TK-\d{5})\b/i)
      if (mHeader) return mHeader[1].toUpperCase()
    }
  }

  return null
}

/**
 * Determina si un correo entrante es una respuesta a un ticket existente
 * (contiene código de ticket en el asunto o en sus cabeceras SMTP).
 */
export function isReplyEmail(
  subject?: string | null,
  headers?: { inReplyTo?: string | null; references?: string | string[] | null; messageId?: string | null } | null
): boolean {
  return extractTicketCode(subject, headers) !== null
}

/**
 * Limpia el cuerpo de un correo en respuesta quitando las citas del correo previo
 * (ej. "On Mon ... wrote:", "-----Mensaje original-----", "De: Soporte", etc.).
 */
export function cleanReplyText(text: string): string {
  if (!text) return ''

  const lines = text.split(/\r?\n/)
  const cleanedLines: string[] = []

  const quoteMarkers = [
    /^-----\s*Mensaje original\s*-----/i,
    /^-----\s*Original Message\s*-----/i,
    /^De:\s+/i,
    /^From:\s+/i,
    /^Enviado el:\s+/i,
    /^Sent:\s+/i,
    /^Para:\s+/i,
    /^To:\s+/i,
    /^Asunto:\s+/i,
    /^Subject:\s+/i,
    /^On\s+.+wrote:$/i,
    /^El\s+.+escribió:$/i,
    /^El\s+.+escribio:$/i,
    /^________________________________/i,
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (quoteMarkers.some(r => r.test(trimmed))) {
      break
    }
    if (trimmed.startsWith('>')) {
      break
    }

    cleanedLines.push(line)
  }

  const result = cleanedLines.join('\n').trim()
  return result || text.trim()
}

/**
 * Quita el prefijo de código de ticket del asunto para usarlo como comentario.
 * Devuelve el asunto limpio.
 */
export function stripTicketCode(subject: string): string {
  return subject
    .replace(/\[?TK-\d{5}\]?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Genera el código secuencial siguiente de ticket de forma robusta.
 * No depende de un count() + 1 (que no es a prueba de concurrencia):
 * recibe la lista de códigos existentes y devuelve el máximo + 1.
 */
export function nextTicketCode(existingCodes: string[]): string {
  let max = 0
  for (const code of existingCodes) {
    const m = code.match(/_(\d+)$/)
    const num = m ? parseInt(m[1], 10) : parseInt(code.replace(/\D/g, ''), 10)
    if (!Number.isNaN(num)) max = Math.max(max, num)
  }
  return `TK-${String(max + 1).padStart(5, '0')}`
}

/**
 * Convierte el cuerpo de un correo (HTML o texto) a texto plano legible.
 * Fuerza un límite de longitud para guardarlo como descripción del ticket.
 */
export function emailBodyToText(email: Pick<ParsedMail, 'text' | 'html'> | null | undefined, maxLength = 2000): string {
  if (!email) return '(Correo vacío)'
  let text = email.text || ''
  if (!text && email.html) {
    text = email.html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (!text) return '(Correo vacío)'
  return text.substring(0, maxLength)
}

/**
 * Normaliza la dirección de un remitente extrayendola de los formatos que
 * entrega mailparser (`from.value[].address`, `from.text`, `from.address`).
 */
export function normalizeFromAddress(from: any): string | null {
  if (typeof from === 'string' && from.trim()) return from.trim().toLowerCase()
  const addr = from?.value?.[0]?.address || from?.address || (typeof from?.text === 'string' ? from.text.match(/<([^>]+)>/)?.[1] : null)
  if (!addr) return null
  return String(addr).trim().toLowerCase()
}
