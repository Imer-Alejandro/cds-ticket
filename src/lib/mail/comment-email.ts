import { toTicketEmailData, type EmailEvent, type EmailThreadHeaders } from './notify-email'

export interface CommentRecipient {
  id: string
  /** Nombre visible completo del destinatario. */
  nombre: string
  correo?: string | null
}

export interface CommentNotifyTicket {
  codigo: string
  asunto: string
  estado: string
  nivelPrioridad: string
  descripcion?: string | null
  solicitanteId?: string | null
  agenteId?: string | null
  messageId?: string | null
  threadRefs?: string | null
  ultimoMessageId?: string | null
}

export interface CommentNotifyInput {
  ticket: CommentNotifyTicket
  /** Autor del comentario (session.id): nunca se le notifica a sí mismo. */
  autorId: string
  esInterno: boolean
  solicitante?: CommentRecipient | null
  agente?: CommentRecipient | null
  comentario: string
}

function wrapId(value?: string | null): string | undefined {
  const t = (value ?? '').trim()
  if (!t) return undefined
  return t.startsWith('<') ? t : `<${t}>`
}

/**
 * Cabeceras SMTP de hilo derivadas de los Message-IDs guardados en el ticket.
 * `inReplyTo` apunta al último mensaje conocido de la rama y `references`
 * contiene la cadena completa (incluida la raíz) para que los clientes de
 * correo encadenen la conversación plataforma↔correo.
 */
export function threadHeadersFromTicket(ticket: {
  messageId?: string | null
  threadRefs?: string | null
  ultimoMessageId?: string | null
}): EmailThreadHeaders {
  const padre = ticket.ultimoMessageId || ticket.messageId || null
  const chain: string[] = []
  for (const raw of [ticket.threadRefs, padre]) {
    if (!raw) continue
    for (const token of String(raw).replace(/[<>]/g, ' ').split(/\s+/)) {
      if (token && !chain.includes(token)) chain.push(token)
    }
  }
  return {
    inReplyTo: wrapId(padre),
    references: chain.length ? chain.map((token) => `<${token}>`).join(' ') : undefined,
  }
}

/**
 * Eventos de correo a generar tras crear un comentario en la plataforma.
 * Reglas: nunca para comentarios internos; notifica al solicitante y al agente
 * asignado salvo que sean el autor. Todos los eventos llevan hilo SMTP.
 */
export function buildCommentEmailEvents(input: CommentNotifyInput): EmailEvent[] {
  if (input.esInterno) return []

  const data = toTicketEmailData(input.ticket)
  const thread = threadHeadersFromTicket(input.ticket)
  const events: EmailEvent[] = []

  if (input.solicitante?.correo && input.solicitante.id !== input.autorId) {
    events.push({
      type: 'NUEVO_COMENTARIO',
      to: input.solicitante.correo,
      nombre: input.solicitante.nombre,
      data,
      comentario: input.comentario,
      ...thread,
    })
  }
  if (input.agente?.correo && input.agente.id !== input.autorId) {
    events.push({
      type: 'NUEVO_COMENTARIO',
      to: input.agente.correo,
      nombre: input.agente.nombre,
      data,
      comentario: input.comentario,
      ...thread,
    })
  }
  return events
}
