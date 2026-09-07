const STATUS_COLORS: Record<string, string> = {
  NUEVO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ASIGNADO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  EN_PROGRESO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESUELTO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CERRADO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  ELIMINADO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICA: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  ALTA: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
  MEDIA: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  BAJA: 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400',
}

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[estado] || STATUS_COLORS.EN_PROGRESO}`}>
      {estado.replace('_', ' ')}
    </span>
  )
}

export function PrioridadBadge({ prioridad }: { prioridad: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_COLORS[prioridad] || PRIORITY_COLORS.MEDIA}`}>
      {prioridad}
    </span>
  )
}

export const ESTADOS = ['NUEVO', 'ASIGNADO', 'EN_PROGRESO', 'PENDIENTE', 'RESUELTO', 'CERRADO', 'ELIMINADO'] as const
export const PRIORIDADES = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'] as const