import {
  ackTicketEmail,
  assignmentEmail,
  statusEmail,
  commentEmail,
  type TicketEmailData,
  type AgentEmailData,
} from './templates'
import { enqueueEmail } from './sender'

export type EmailEvent =
  | { type: 'TICKET_CREADO'; to: string; nombre: string; data: TicketEmailData }
  | { type: 'TICKET_ASIGNADO'; to: string; agenteNombre: string; data: TicketEmailData }
  | { type: 'ESTADO_CAMBIADO'; to: string; nombre: string; data: TicketEmailData; estadoLabel: string }
  | { type: 'NUEVO_COMENTARIO'; to: string; nombre: string; data: TicketEmailData; comentario: string }

/**
 * Convierte un evento de dominio a mensajes de correo listos para enviar.
 * Es una función pura: dado un evento, devuelve el mensaje {to, subject, html}.
 * Así es fácil testearlo sin tocar la red.
 */
export function buildEmailMessage(ev: EmailEvent): { to: string; subject: string; html: string } {
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

/**
 * Encola un evento de correo en la cola global (con reintentos).
 * No lanza errores: la notificación por email nunca debe romper el flujo del ticket.
 */
export function notifyByEmail(ev: EmailEvent): void {
  try {
    const msg = buildEmailMessage(ev)
    enqueueEmail(msg)
  } catch {
    // el email no puede romper el flujo
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