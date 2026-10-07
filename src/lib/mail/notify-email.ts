import {
  ackTicketEmail,
  assignmentEmail,
  statusEmail,
  commentEmail,
  type TicketEmailData,
  type AgentEmailData,
} from './templates'
import { enqueueEmail } from './sender'
import type { EmailAttachment, EmailMessage } from './outbox'

/** Cabeceras de hilo de conversación (SMTP) de un evento de correo. */
export interface EmailThreadHeaders {
  /** Message-ID del mensaje al que responde este correo (sin ángulos o con ellos). */
  inReplyTo?: string | null
  /** Cadena References de la rama (space-separated). */
  references?: string | null
}

export type EmailEvent = (
  | { type: 'TICKET_CREADO'; to: string; nombre: string; data: TicketEmailData }
  | { type: 'TICKET_ASIGNADO'; to: string; agenteNombre: string; data: TicketEmailData }
  | { type: 'ESTADO_CAMBIADO'; to: string; nombre: string; data: TicketEmailData; estadoLabel: string }
  | { type: 'NUEVO_COMENTARIO'; to: string; nombre: string; data: TicketEmailData; comentario: string }
) &
  EmailThreadHeaders & {
    /** Adjuntos del comentario (base64) que viajan como archivos del correo. */
    adjuntos?: EmailAttachment[]
  }

/**
 * Convierte un evento de dominio a mensajes de correo listos para enviar.
 * Es una función pura: dado un evento, devuelve el mensaje {to, subject, html}.
 * Así es fácil testearlo sin tocar la red.
 */
export function buildEmailMessage(ev: EmailEvent): EmailMessage {
  const base = () => {
    switch (ev.type) {
      case 'TICKET_CREADO': {
        const { subject, html } = ackTicketEmail(ev.nombre, ev.data)
        return { to: ev.to, subject, html }
      }
      case 'TICKET_ASIGNADO': {
        const agentData: AgentEmailData = { ...ev.data, agenteNombre: ev.agenteNombre }
        const { subject, html } = assignmentEmail(agentData)
        return { to: ev.to, subject, html }
      }
      case 'ESTADO_CAMBIADO': {
        const { subject, html } = statusEmail(ev.nombre, { ...ev.data, estadoLabel: ev.estadoLabel })
        return { to: ev.to, subject, html }
      }
      case 'NUEVO_COMENTARIO': {
        const { subject, html } = commentEmail(ev.nombre, ev.data, ev.comentario)
        return { to: ev.to, subject, html }
      }
    }
  }
  return {
    ...base(),
    inReplyTo: ev.inReplyTo ?? undefined,
    references: ev.references ?? undefined,
    attachments: ev.adjuntos?.length ? ev.adjuntos : undefined,
  }
}

/**
 * Encola un evento de correo en la cola global (con reintentos).
 * No lanza errores: la notificación por email nunca debe romper el flujo del ticket.
 */
export function notifyByEmail(ev: EmailEvent): void {
  try {
    const msg = buildEmailMessage(ev)
    enqueueEmail(msg)
  } catch (err) {
    // el email no puede romper el flujo, pero el fallo debe quedar en el log
    console.error('[Mail] Error al encolar email de notificación:', err)
  }
}

/** Helper de contexto: pasa un ticket a TicketEmailData */
export function toTicketEmailData(d: {
  codigo: string
  asunto: string
  estado: string
  nivelPrioridad: string
  descripcion?: string | null
}): TicketEmailData {
  return {
    codigo: d.codigo,
    asunto: d.asunto,
    estado: d.estado,
    prioridad: d.nivelPrioridad,
    descripcion: d.descripcion ?? '',
  }
}