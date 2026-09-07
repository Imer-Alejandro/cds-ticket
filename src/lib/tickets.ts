/**
 * Dominio de tickets: estados, prioridades y orígenes como constantes tipadas.
 * Sustituye los strings sueltos para asegurar valores válidos en tiempo de
 * desarrollo (los enums DE PRISMA requieren migración de la BD).
 */

export const ESTADOS_TICKET = ['NUEVO', 'ASIGNADO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO'] as const
export type EstadoTicket = (typeof ESTADOS_TICKET)[number]

export const PRIORIDADES_TICKET = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'] as const
export type PrioridadTicket = (typeof PRIORIDADES_TICKET)[number]

export const ORIGENES_TICKET = ['WEB', 'CORREO'] as const
export type OrigenTicket = (typeof ORIGENES_TICKET)[number]

/** Estados considerados "abiertos" para cómputo de carga de agentes y SLA. */
export const ESTADOS_ACTIVOS: EstadoTicket[] = ['NUEVO', 'ASIGNADO', 'EN_PROGRESO']

export function esEstadoTicket(v: unknown): v is EstadoTicket {
  return typeof v === 'string' && (ESTADOS_TICKET as readonly string[]).includes(v)
}

export function esPrioridadTicket(v: unknown): v is PrioridadTicket {
  return typeof v === 'string' && (PRIORIDADES_TICKET as readonly string[]).includes(v)
}

export function esOrigenTicket(v: unknown): v is OrigenTicket {
  return typeof v === 'string' && (ORIGENES_TICKET as readonly string[]).includes(v)
}

const ETIQUETAS_ESTADO: Record<EstadoTicket, string> = {
  NUEVO: 'Nuevo',
  ASIGNADO: 'Asignado',
  EN_PROGRESO: 'En Progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
}

export function etiquetaEstado(estado: string): string {
  return ETIQUETAS_ESTADO[estado as EstadoTicket] || estado
}