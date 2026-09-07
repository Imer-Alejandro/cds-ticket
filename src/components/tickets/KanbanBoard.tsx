"use client"

import { useRouter } from "next/navigation"

export interface KanbanTicket {
  id: string
  codigo: string
  asunto: string
  estado: string
  nivelPrioridad: string
  fechaCreacion: string
  categoria: { nombre: string }
  solicitante: { nombre: string; apellido: string }
  agente: { nombre: string; apellido: string } | null
}

const COLUMNAS: { estado: string; label: string; dot: string; bg: string }[] = [
  { estado: "NUEVO", label: "Nuevos", dot: "bg-purple-500", bg: "border-purple-200 dark:border-purple-900/40" },
  { estado: "ASIGNADO", label: "Asignados", dot: "bg-indigo-500", bg: "border-indigo-200 dark:border-indigo-900/40" },
  { estado: "EN_PROGRESO", label: "En Progreso", dot: "bg-blue-500", bg: "border-blue-200 dark:border-blue-900/40" },
  { estado: "RESUELTO", label: "Resueltos", dot: "bg-emerald-500", bg: "border-emerald-200 dark:border-emerald-900/40" },
  { estado: "CERRADO", label: "Cerrados", dot: "bg-slate-400", bg: "border-slate-200 dark:border-slate-700" },
]

const PRIO_DOT: Record<string, string> = {
  CRITICA: "bg-red-500", ALTA: "bg-orange-500", MEDIA: "bg-blue-400", BAJA: "bg-slate-400",
}

/** Tablero Kanban por estado de ticket. Componente puro (recibe las tarjetas). */
export function KanbanBoard({ tickets }: { tickets: KanbanTicket[] }) {
  const router = useRouter()
  return (
    <div className="grid gap-4 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${COLUMNAS.length}, minmax(240px, 1fr))` }}>
      {COLUMNAS.map(col => {
        const cards = tickets.filter(t => t.estado === col.estado)
        return (
          <div key={col.estado} className={`rounded-2xl border bg-muted/20 flex flex-col min-h-[300px] ${col.bg}`}>
            <div className="flex items-center gap-2 px-4 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
              <span className="ml-auto inline-flex items-center rounded-full bg-card border border-border px-2 py-0.5 text-xs font-bold">
                {cards.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 px-2.5 pb-3">
              {cards.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center pt-6">Sin tickets</p>
              )}
              {cards.map(t => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold text-primary">{t.codigo}</span>
                    <span className={`h-2 w-2 rounded-full ${PRIO_DOT[t.nivelPrioridad] || PRIO_DOT.MEDIA}`} title={t.nivelPrioridad} />
                  </div>
                  <p className="text-sm font-medium mt-1.5 line-clamp-2 group-hover:text-primary transition-colors">{t.asunto}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{t.categoria.nombre}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {t.solicitante.nombre} {t.solicitante.apellido}
                    </span>
                    {t.agente
                      ? (<span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">{t.agente.nombre} {t.agente.apellido}</span>)
                      : (<span className="text-[10px] italic text-muted-foreground/60">Sin asignar</span>)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function KanbanToggle({ view, onChange }: { view: "table" | "kanban"; onChange: (v: "table" | "kanban") => void }) {
  return (
    <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
      {(["table", "kanban"] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            view === v ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {v === "table" ? "Tabla" : "Tablero"}
        </button>
      ))}
    </div>
  )
}