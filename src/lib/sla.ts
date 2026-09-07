/**
 * Cálculos de SLA de tickets (independientes del módulo de correo).
 */

export interface SlaResult {
  elapsedMinutes: number
  responseStatus: 'ok' | 'warning' | 'breached'
  resolutionStatus: 'ok' | 'warning' | 'breached'
  responseLimitMinutes: number
  resolutionLimitMinutes: number
}

/**
 * Calcula el estado de cumplimiento del SLA para un ticket creado en `createdAt`.
 * Devuelve un objeto con los minutos transcurridos, el límite y si está en rojo.
 */
export function slaStatus(opts: {
  createdAt: string | Date
  firstResponseAt?: string | Date | null
  minutesResponse: number
  minutesResolution: number
  resolvedAt?: string | Date | null
  now?: Date
}): SlaResult {
  const now = opts.now ?? new Date()
  const createdAt = new Date(opts.createdAt)
  const elapsed = Math.max(0, (now.getTime() - createdAt.getTime()) / 60000)

  let responseStatus: SlaResult['responseStatus'] = 'ok'
  if (opts.firstResponseAt) {
    const respMinutes = (new Date(opts.firstResponseAt).getTime() - createdAt.getTime()) / 60000
    responseStatus = respMinutes <= opts.minutesResponse ? 'ok' : 'breached'
  } else if (elapsed > opts.minutesResponse) {
    responseStatus = 'breached'
  } else if (elapsed > opts.minutesResponse * 0.75) {
    responseStatus = 'warning'
  }

  let resolutionStatus: SlaResult['resolutionStatus'] = 'ok'
  if (opts.resolvedAt) {
    const resMinutes = (new Date(opts.resolvedAt).getTime() - createdAt.getTime()) / 60000
    resolutionStatus = resMinutes <= opts.minutesResolution ? 'ok' : 'breached'
  } else if (elapsed > opts.minutesResolution) {
    resolutionStatus = 'breached'
  } else if (elapsed > opts.minutesResolution * 0.75) {
    resolutionStatus = 'warning'
  }

  return {
    elapsedMinutes: Math.round(elapsed),
    responseStatus,
    resolutionStatus,
    responseLimitMinutes: opts.minutesResponse,
    resolutionLimitMinutes: opts.minutesResolution,
  }
}

/** Formatea minutos en "Xd Xh Xm" para visualización compacta. */
export function formatSlaMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  const days = Math.floor(m / 1440)
  const hours = Math.floor((m % 1440) / 60)
  const mins = m % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (mins || !parts.length) parts.push(`${mins}m`)
  return parts.join(' ')
}

/** Porcentaje consumido [0..1] de un límite, saturando en 1. */
export function slaProgress(elapsedMinutes: number, limitMinutes: number): number {
  if (limitMinutes <= 0) return 0
  return Math.min(1, Math.max(0, elapsedMinutes / limitMinutes))
}