import { extractTicketCode } from './core'
import type { EmailAttachment } from './outbox'

export interface GraphMailInput {
  to: string
  subject: string
  html: string
  headers?: { messageId?: string; inReplyTo?: string; references?: string }
  attachments?: EmailAttachment[]
}

/** Identificadores que Graph asigna al mensaje realmente enviado. */
export interface GraphSendResult {
  /** Message-ID RFC 5322 del mensaje enviado (con o sin <>). */
  internetMessageId?: string
  /** Conversación (hilo) a la que pertenece el mensaje enviado. */
  conversationId?: string
}

interface GraphMessage {
  id?: string
  internetMessageId?: string
  conversationId?: string
}

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

/** Adjuntos en el formato de fileAttachment que entiende Graph. */
function graphAttachments(attachments?: EmailAttachment[]) {
  if (!attachments?.length) return undefined
  return attachments.map((a) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.nombre,
    contentType: a.tipo,
    contentBytes: a.data,
  }))
}

/** Cuerpo `message` que acepta tanto /me/messages como createReply. */
function buildMessage(mail: GraphMailInput) {
  const message: Record<string, unknown> = {
    subject: mail.subject,
    body: { contentType: 'HTML', content: mail.html },
    toRecipients: [{ emailAddress: { address: mail.to } }],
  }
  const attachments = graphAttachments(mail.attachments)
  if (attachments) message.attachments = attachments
  return message
}

/**
 * Envía un correo por Microsoft Graph. Se usa cuando la configuración es OAuth2
 * porque los tenants corporativos suelen tener SMTP AUTH bloqueado
 * (535 SmtpClientAuthentication).
 *
 * Graph NO acepta In-Reply-To/References en `internetMessageHeaders` (400
 * InvalidInternetMessageHeader, solo cabeceras `x-`), así que el hilo de
 * conversación se conserva con el flujo nativo: si el mensaje referenciado
 * existe en el buzón se responde con `createReply` (Exchange construye los
 * encadenados); si no, se crea un mensaje nuevo.
 *
 * En ambos casos se devuelve el `internetMessageId` del mensaje enviado para
 * poder guardarlo en el ticket y encadenar los correos siguientes.
 */
export async function sendEmailViaGraph(
  accessToken: string,
  mail: GraphMailInput,
): Promise<GraphSendResult> {
  const message = buildMessage(mail)

  const candidates = extractTicketCode(mail.subject) ? threadCandidates(mail.headers) : []
  const targetId = candidates.length ? await findThreadMessageId(accessToken, candidates) : null

  if (targetId) {
    const draft = await graphRequest<GraphMessage>(
      accessToken,
      `${GRAPH_API}/me/messages/${targetId}/createReply`,
      'POST',
      { message },
    )
    if (!draft?.id) {
      throw new Error('Microsoft Graph no devolvió el borrador de respuesta')
    }
    const ids = await sentIds(accessToken, draft)
    await graphRequest(accessToken, `${GRAPH_API}/me/messages/${draft.id}/send`, 'POST', {})
    return ids
  }

  if (candidates.length) {
    console.warn(`[Mail] No se encontró el mensaje del hilo en el buzón (${candidates[0]}); se envía sin encadenar`)
  }

  // Se crea como borrador (en vez de sendMail) para conocer el id del mensaje
  // y poder leer su internetMessageId: es el ancla para encadenar respuestas.
  const created = await graphRequest<GraphMessage>(accessToken, `${GRAPH_API}/me/messages`, 'POST', message)
  if (!created?.id) {
    throw new Error('Microsoft Graph no devolvió el mensaje creado')
  }
  const ids = await sentIds(accessToken, created)
  await graphRequest(accessToken, `${GRAPH_API}/me/messages/${created.id}/send`, 'POST', {})
  return ids
}

/**
 * Lee los identificadores del mensaje (borrador) antes de enviarlo. La respuesta de creación suele
 * traerlos; si no, se consultan por id (una sola petición).
 */
async function sentIds(accessToken: string, msg: GraphMessage): Promise<GraphSendResult> {
  if (msg.internetMessageId || !msg.id) {
    return { internetMessageId: msg.internetMessageId, conversationId: msg.conversationId }
  }
  try {
    const fresh = await graphRequest<GraphMessage>(
      accessToken,
      `${GRAPH_API}/me/messages/${msg.id}?$select=internetMessageId,conversationId`,
      'GET',
    )
    return {
      internetMessageId: fresh?.internetMessageId ?? msg.internetMessageId,
      conversationId: fresh?.conversationId ?? msg.conversationId,
    }
  } catch {
    return { conversationId: msg.conversationId }
  }
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
 * Busca en el buzón los internetMessageIds del hilo, probando los candidatos en
 * orden (primero el padre). Devuelve el id de Graph del primero que exista; si
 * ninguno está, devuelve null y el correo sale sin encadenar: un fallo de
 * búsqueda nunca debe impedir el envío.
 */
async function findThreadMessageId(accessToken: string, candidates: string[]): Promise<string | null> {
  for (const id of candidates.slice(0, 3)) {
    try {
      const filter = `internetMessageId eq '${encodeURIComponent(`<${id}>`)}'`
      const res = await graphRequest<{ value?: { id?: string }[] }>(
        accessToken,
        `${GRAPH_API}/me/messages?$filter=${filter}&$select=id&$top=1`,
        'GET',
      )
      if (res?.value?.[0]?.id) return res.value[0].id
    } catch {
      // Un fallo de búsqueda no debe impedir probar el siguiente candidato.
    }
  }
  return null
}

/** Petición Graph con manejo uniforme de errores. Devuelve el JSON o lanza. */
async function graphRequest<T = Record<string, unknown>>(
  accessToken: string,
  url: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => null) as
      | { error?: { code?: string; message?: string } }
      | null
    const code = errBody?.error?.code ? ` ${errBody.error.code}` : ''
    throw new Error(
      `Microsoft Graph rechazó la operación (${response.status}${code}): ${errBody?.error?.message || 'sin detalle'}`,
    )
  }
  return await response.json().catch(() => ({} as T)) as T
}
