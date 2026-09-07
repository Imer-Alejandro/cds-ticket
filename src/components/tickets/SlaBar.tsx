import { Clock } from 'lucide-react'
import { slaStatus, formatSlaMinutes, slaProgress } from '@/lib/sla'

const COLORS = {
  ok: { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  breached: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
} as const

export interface SlaBarProps {
  createdAt: string | Date
  minutesResponse: number
  minutesResolution: number
  firstResponseAt?: string | Date | null
  resolvedAt?: string | Date | null
  mode?: 'response' | 'resolution'
  showLabel?: boolean
  now?: Date
}

/** Barra de progreso SLA para una fila o detalle de ticket. */
export function SlaBar({
  createdAt,
  minutesResponse,
  minutesResolution,
  firstResponseAt,
  resolvedAt,
  mode = 'resolution',
  showLabel = true,
  now,
}: SlaBarProps) {
  const s = slaStatus({ createdAt, firstResponseAt, minutesResponse, minutesResolution, resolvedAt, now })
  const status = mode === 'response' ? s.responseStatus : s.resolutionStatus
  const limit = mode === 'response' ? s.responseLimitMinutes : s.resolutionLimitMinutes
  const pct = slaProgress(s.elapsedMinutes, limit) * 100
  const color = COLORS[status]

  const label = mode === 'response'
    ? `Respuesta ${formatSlaMinutes(s.elapsedMinutes)} / ${formatSlaMinutes(limit)}`
    : `Resolución ${formatSlaMinutes(s.elapsedMinutes)} / ${formatSlaMinutes(limit)}`

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color.bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        {showLabel && (
          <div className={`mt-1 text-[11px] font-medium leading-none ${color.text}`}>{label}</div>
        )}
      </div>
    </div>
  )
}

/** Etiqueta compacta del estado SLA (para celdas con poco espacio). */
export function SlaChip({ status }: { status: 'ok' | 'warning' | 'breached' }) {
  const color = COLORS[status]
  const label = status === 'ok' ? 'En tiempo' : status === 'warning' ? 'Por vencer' : 'Vencido'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${color.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${color.bar}`} />
      {label}
    </span>
  )
}