import { extractTicketCode } from './core'

export interface GraphMailInput {
  to: string
  subject: string
  html: string
  headers?: { messageId?: string; inReplyTo?: string; references?: string }
}

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

/**
 * Envía un correo por Microsoft Graph. Se usa cuando la configuración es OAuth2
 * porque los tenants corporativos suelen tener SMTP AUTH bloqueado
 * (535 SmtpClientAuthentication).
 *
 * Graph NO acepta In-Reply-To/References en `internetMessageHeaders` (400
 * InvalidInternetMessageHeader, solo cabeceras `x-`), así que el hilo de
 * conversación se conserva con el flujo nativo: si el mensaje referenciado
 * existe en el buzón se responde con `createReply` + `send` (Exchange construye
 * los encadenados); si no, se envía un mensaje nuevo sin hilo.
 */
export async function sendEmailViaGraph(
  accessToken: string,
  mail: GraphMailInput,
): Promise<void> {
  const message = {
    subject: mail.subject,
    body: { contentType: 'HTML', content: mail.html },
    toRecipients: [{ emailAddress: { address: mail.to } }],
  }

  const candidates = extractTicketCode(mail.subject) ? threadCandidates(mail.headers) : []
  const targetId = candidates.length ? await findThreadMessageId(accessToken, candidates) : null

  if (targetId) {
    const draft = await postGraph(accessToken, `${GRAPH_API}/me/messages/${targetId}/createReply`, { message })
    if (!draft.id) {
      throw new Error('Microsoft Graph no devolvió el borrador de respuesta')
    }
    await postGraph(accessToken, `${GRAPH_API}/me/messages/${draft.id}/send`, {})
    return
  }

  if (candidates.length) {
    console.warn(`[Mail] No se encontró el mensaje del hilo en el buzón (${candidates[0]}); se envía sin encadenar`)
  }

  await postGraph(accessToken, `${GRAPH_API}/me/sendMail`, { message, saveToSentItems: true })
}

/**
 * Ids de mensajes del hilo ordenados del más reciente al más antiguo:
 * primero el padre (In-Reply-To) y luego la cadena de References.
 */
function threadCandidates(headers?: GraphMailInput['headers']): string[] {
  const tokens: string[] = []
  for (const raw of [headers?.inReplyTo, headers?.references]) {
    if (!raw) continue
    for (const token of String(raw).split(/\s+/)) {
      const id = token.replace(/[<>]/g, '')
      if (id && !tokens.includes(id)) tokens.push(id)
    }
  }
  return tokens
}

/**
 * Busca en el buzón el mensaje con el internetMessageId indicado (con sus
 * ángulos incluidos, codificados para OData). Devuelve el id de Graph o null
 * si no está; cualquier fallo de búsqueda se degrada a "sin hilo" para que el
 * correo salga de todos modos.
 */
async function findThreadMessageId(accessToken: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates.slice(0, 3)) {
    try {
      const filter = encodeURIComponent(`<${candidate}>`)
      const response = await fetch(
        `${GRAPH_API}/me/messages?$filter=internetMessageId eq '${filter}'&$select=id`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!response.ok) {
        console.warn(`[Mail] Graph no pudo buscar el mensaje del hilo (${response.status})`)
        continue
      }
      const body = await response.json() as { value?: { id?: string }[] }
      const id = body.value?.[0]?.id
      if (id) return id
    } catch (error) {
      console.warn('[Mail] Graph falló al buscar el mensaje del hilo:', error instanceof Error ? error.message : error)
    }
  }
  return null
}

async function postGraph(accessToken: string, url: string, payload: unknown): Promise<{ id?: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { code?: string; message?: string } }
      | null
    const code = body?.error?.code ? ` ${body.error.code}` : ''
    throw new Error(
      `Microsoft Graph rechazó la operación (${response.status}${code}): ${body?.error?.message || 'sin detalle'}`,
    )
  }
  return await response.json().catch(() => ({ id: undefined })) as { id?: string }
}
