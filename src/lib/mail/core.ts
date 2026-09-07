import type { ParsedMail } from 'mailparser'
export { slaStatus } from '@/lib/sla'

/**
 * Extrae el código de ticket (TK-#####) que aparece en el asunto de un correo,
 * para poder vincular respuestas (RE:) al ticket original.
 */
export function extractTicketCode(subject?: string | null): string | null {
  if (!subject) return null
  const m = subject.match(/\b(TK-\d{5})\b/i)
  return m ? m[1] : null
}

/**
 * Determina si un correo entrante es una respuesta a un ticket existente
 * (contiene un código TK-##### en el asunto, típicamente por prefijo RE:).
 */
export function isReplyEmail(subject?: string | null): boolean {
  return extractTicketCode(subject) !== null
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
  const addr = from?.value?.[0]?.address || from?.address || (typeof from?.text === 'string' ? from.text.match(/<([^>]+)>/)?.[1] : null)
  if (!addr) return null
  return String(addr).trim().toLowerCase()
}
