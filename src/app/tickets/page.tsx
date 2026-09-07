"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, ArrowUpDown, Loader2, FilterX, ChevronLeft, ChevronRight, Inbox, UserCheck, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/useAuthStore"
import { apiFetch } from "@/lib/api"
import { useSocket, onNotificacion } from "@/hooks/useSocket"
import { playNotificationSound } from "@/lib/sound"
import { EstadoBadge, PrioridadBadge } from "@/components/tickets/badges"
import { SlaBar } from "@/components/tickets/SlaBar"
import { KanbanBoard, KanbanToggle, type KanbanTicket } from "@/components/tickets/KanbanBoard"
import { EmptyState } from "@/components/ui/empty-state"

interface Ticket {
  id: string; codigo: string; asunto: string; estado: string; nivelPrioridad: string
  solicitante: { nombre: string; apellido: string }
  agente: { nombre: string; apellido: string } | null
  categoria: { nombre: string }
  sla: { id: string; minutosRespuesta: number; minutosResolucion: number } | null
  fechaCreacion: string
}

interface TicketListResponse {
  tickets: Ticket[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ESTADOS = ["", "NUEVO", "ASIGNADO", "EN_PROGRESO", "RESUELTO", "CERRADO"]
const PRIORIDADES = ["", "CRITICA", "ALTA", "MEDIA", "BAJA"]

const ESTADO_LABEL: Record<string, string> = {
  NUEVO: "Nuevo", ASIGNADO: "Asignado", EN_PROGRESO: "En Progreso", RESUELTO: "Resuelto", CERRADO: "Cerrado",
}

type VistaFilter = "todos" | "mios" | "sinAsignar"

export default function TicketsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("")
  const [prioridadFilter, setPrioridadFilter] = useState("")
  const [sortField, setSortField] = useState("fechaCreacion")
  const [sortDir, setSortDir] = useState("desc")
  const [vista, setVista] = useState<VistaFilter>("todos")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ misActivos: 0, noAsignados: 0 })
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [fetchTick, setFetchTick] = useState(0)
  const [view, setView] = useState<"table" | "kanban">("table")

  const pageSize = view === "kanban" ? 100 : 20

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tickets/stats")
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  useSocket()

  const refetch = useCallback(() => {
    setFetchTick(t => t + 1)
  }, [])

  useEffect(() => {
    const unsubNuevo = onNotificacion('nuevoTicket', (data: any) => {
      if (data?.ticket?.id) {
        setHighlightedId(data.ticket.id)
        playNotificationSound()
        setTimeout(() => setHighlightedId(null), 2500)
        refetch()
      }
    })
    const unsubUpdate = onNotificacion('ticketUpdated', () => { refetch() })
    return () => { unsubNuevo(); unsubUpdate() }
  }, [refetch])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (estadoFilter) params.set("estado", estadoFilter)
    if (prioridadFilter) params.set("prioridad", prioridadFilter)
    if (vista === "mios" && user?.id) params.set("asignadosA", user.id)
    if (vista === "sinAsignar") params.set("sinAsignar", "true")
    params.set("sortField", sortField)
    params.set("sortDir", sortDir)
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    apiFetch(`/api/tickets?${params}`)
      .then(r => r.ok && r.json())
      .then((data: TicketListResponse | null) => {
        setTickets(data?.tickets || [])
        setTotal(data?.total || 0)
        setTotalPages(data?.totalPages || 1)
      })
      .finally(() => setLoading(false))
  }, [search, estadoFilter, prioridadFilter, sortField, sortDir, vista, user?.id, page, fetchTick, view])

  const hasFilters = search || estadoFilter || prioridadFilter || vista !== "todos"

  const handleSort = (f: string) => {
    if (f === sortField) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(f); setSortDir("asc")
    }
  }

  const clearFilters = () => {
    setSearch(""); setEstadoFilter(""); setPrioridadFilter(""); setVista("todos"); setPage(1)
  }

  const vistaButton = (v: VistaFilter, label: string, count: number, icon?: React.ReactNode) => (
    <button
      onClick={() => { setVista(v); setPage(1) }}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        vista === v ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${vista === v ? "bg-white/20" : "bg-muted"}`}>{count}</span>
    </button>
  )

  return (
    <div className="space-y-6 px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Tickets</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Ticket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
            <p className="text-sm text-muted-foreground">Gestiona y da seguimiento a las solicitudes de soporte</p>
          </div>
        </div>
        <Link href="/tickets/new">
          <Button className="rounded-xl gap-2 h-11 shadow-sm">
            <Plus className="h-4 w-4" /> Nuevo Ticket
          </Button>
        </Link>
      </div>

      {/* Vista rápida: Mis tickets / Sin asignar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {vistaButton("todos", "Todos", total)}
          {vistaButton("mios", "Mis tickets", stats.misActivos, <UserCheck className="h-4 w-4" />)}
          {vistaButton("sinAsignar", "Sin asignar", stats.noAsignados, <Inbox className="h-4 w-4" />)}
        </div>
        <KanbanToggle view={view} onChange={v => { setView(v); setPage(1) }} />
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por asunto, código, correo o agente..."
              className="pl-10 rounded-xl h-10 bg-muted/30 border-0 focus-visible:bg-background focus-visible:border focus-visible:border-input"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            value={estadoFilter}
            onChange={e => { setEstadoFilter(e.target.value); setPage(1) }}
            className="h-10 rounded-xl border border-border bg-transparent px-3 text-sm min-w-[130px]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.filter(Boolean).map(e => (
              <option key={e} value={e}>{ESTADO_LABEL[e] || e}</option>
            ))}
          </select>
          <select
            value={prioridadFilter}
            onChange={e => { setPrioridadFilter(e.target.value); setPage(1) }}
            className="h-10 rounded-xl border border-border bg-transparent px-3 text-sm min-w-[130px]"
          >
            <option value="">Todas las prioridades</option>
            {PRIORIDADES.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground rounded-xl gap-1.5"
              onClick={clearFilters}
            >
              <FilterX className="h-4 w-4" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {view === "kanban" ? (
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tickets...</div>
          ) : tickets.length === 0 ? (
            <EmptyState title="No hay tickets" subtitle={vista === "mios" ? "Aún no tienes tickets asignados" : vista === "sinAsignar" ? "No hay tickets sin asignar" : "Crea tu primer ticket para comenzar"}
              action={<Link href="/tickets/new"><Button variant="outline" size="sm" className="rounded-xl">Crear primer ticket</Button></Link>} />
          ) : (
            <KanbanBoard tickets={tickets as unknown as KanbanTicket[]} />
          )}
        </div>
      ) : (
      /* Table */
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <Th sortable field="codigo" current={sortField} dir={sortDir} onClick={f => handleSort(f)}>Código</Th>
                <Th sortable field="asunto" current={sortField} dir={sortDir} onClick={f => handleSort(f)}>Asunto</Th>
                <Th>Solicitante</Th>
                <Th className="text-center">Estado</Th>
                <Th className="text-center">Prioridad</Th>
                <Th>Asignado</Th>
                <Th>Resolución SLA</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-20 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tickets...</div>
                </td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState title="No hay tickets"
                    subtitle={vista === "mios" ? "Aún no tienes tickets asignados" : vista === "sinAsignar" ? "No hay tickets sin asignar" : "Crea tu primer ticket para comenzar"}
                    action={<Link href="/tickets/new"><Button variant="outline" size="sm" className="rounded-xl mt-1">Crear primer ticket</Button></Link>} />
                </td></tr>
              ) : (
                tickets.map(t => (
                  <tr
                    key={t.id}
                    className={`border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer group ${highlightedId === t.id ? 'bg-amber-100/70 dark:bg-amber-900/20 animate-pulse' : ''}`}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                  >
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-semibold text-primary">{t.codigo}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium truncate max-w-[280px]">{t.asunto}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.categoria.nombre}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {t.solicitante.nombre.charAt(0)}{t.solicitante.apellido.charAt(0)}
                        </div>
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {t.solicitante.nombre} {t.solicitante.apellido}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <EstadoBadge estado={t.estado} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <PrioridadBadge prioridad={t.nivelPrioridad} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">
                        {t.agente ? `${t.agente.nombre} ${t.agente.apellido}` : <span className="italic">Sin asignar</span>}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {t.sla
                        ? (<SlaBar createdAt={t.fechaCreacion} minutesResponse={t.sla.minutosRespuesta} minutesResolution={t.sla.minutosResolucion} mode="resolution" />)
                        : (<span className="text-xs text-muted-foreground">Sin SLA</span>)
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && tickets.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {total} ticket{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" className="rounded-lg h-8 px-2.5"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="sm" className="rounded-lg h-8 px-2.5"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function Th({ children, sortable, field, current, dir, onClick, className }: {
  children: React.ReactNode; sortable?: boolean; field?: string; current?: string; dir?: string; onClick?: (f: string) => void; className?: string
}) {
  const isActive = sortable && field === current
  return (
    <th
      className={`px-4 py-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase ${sortable ? "cursor-pointer hover:text-foreground select-none" : ""} ${className || ""}`}
      onClick={sortable && field ? () => onClick?.(field) : undefined}
    >
      <span className="flex items-center gap-1.5">
        {children}
        {sortable && <ArrowUpDown className={`h-3 w-3 transition-colors ${isActive ? "text-foreground" : "opacity-50"}`} />}
      </span>
    </th>
  )
}