export type SlaEventType = 'AVISO_RESPUESTA' | 'VENCIDO_RESPUESTA' | 'VENCIDO_RESOLUCION'

export const SLA_EVENT_ORDER: SlaEventType[] = ['AVISO_RESPUESTA', 'VENCIDO_RESPUESTA', 'VENCIDO_RESOLUCION']

export interface SlaTicketLite {
  id: string
  codigo: string
  creadoEl: string | Date
  primeraRespuesta?: string | Date | null
  resueltoEl?: string | Date | null
  sla: { minutosRespuesta: number; minutosResolucion: number } | null
}

const PORCENTAJE_AVISO = 0.75

/**
 * Determina qué eventos de SLA corresponden a un ticket abierto, evitando
 * repetir los que ya fueron avisados (`yaAvisados`). Reglas:
 *  - AVISO_RESPUESTA: sin primera respuesta y alcanzado el 75% del plazo.
 *  - VENCIDO_RESPUESTA: sin primera respuesta y superado el plazo de respuesta.
 *  - VENCIDO_RESOLUCION: no resuelto y superado el plazo de resolución.
 */
export function computeSlaEvents(
  ticket: SlaTicketLite,
  yaAvisados: SlaEventType[] = [],
  now?: Date
): SlaEventType[] {
  if (!ticket.sla || ticket.sla.minutosRespuesta <= 0) return []

  const nowMs = (now ?? new Date()).getTime()
  const creadoMs = new Date(ticket.creadoEl).getTime()
  const elapsed = Math.max(0, (nowMs - creadoMs) / 60000)

  const eventos: SlaEventType[] = []
  const ya = (t: SlaEventType) => yaAvisados.includes(t)

  if (!ticket.primeraRespuesta) {
    if (elapsed > ticket.sla.minutosRespuesta && !ya('VENCIDO_RESPUESTA')) {
      eventos.push('VENCIDO_RESPUESTA')
    } else if (elapsed >= ticket.sla.minutosRespuesta * PORCENTAJE_AVISO && !ya('AVISO_RESPUESTA')) {
      eventos.push('AVISO_RESPUESTA')
    }
  }

  if (!ticket.resueltoEl && elapsed > ticket.sla.minutosResolucion && !ya('VENCIDO_RESOLUCION')) {
    eventos.push('VENCIDO_RESOLUCION')
  }

  return eventos
}