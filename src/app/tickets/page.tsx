"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Search, ArrowUpDown, FileText, Clock, Loader2, Ticket, FilterX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Ticket {
  id: string; codigo: string; asunto: string; estado: string; nivelPrioridad: string
  solicitante: { nombre: string; apellido: string }
  agente: { nombre: string; apellido: string } | null
  categoria: { nombre: string }
  fechaCreacion: string
}

const ESTADOS = ["", "NUEVO", "ASIGNADO", "EN_PROGRESO", "RESUELTO", "CERRADO"]
const PRIORIDADES = ["", "CRITICA", "ALTA", "MEDIA", "BAJA"]

const ESTADO_BADGE: Record<string, string> = {
  NUEVO: "bg-blue-50 text-blue-700 border-blue-200",
  ASIGNADO: "bg-amber-50 text-amber-700 border-amber-200",
  EN_PROGRESO: "bg-orange-50 text-orange-700 border-orange-200",
  RESUELTO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CERRADO: "bg-slate-100 text-slate-600 border-slate-200",
}
const PRIORIDAD_BADGE: Record<string, string> = {
  CRITICA: "bg-red-50 text-red-700 border-red-200",
  ALTA: "bg-orange-50 text-orange-700 border-orange-200",
  MEDIA: "bg-blue-50 text-blue-700 border-blue-200",
  BAJA: "bg-green-50 text-green-700 border-green-200",
}

const ESTADO_LABEL: Record<string, string> = {
  NUEVO: "Nuevo", ASIGNADO: "Asignado", EN_PROGRESO: "En Progreso", RESUELTO: "Resuelto", CERRADO: "Cerrado",
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("")
  const [prioridadFilter, setPrioridadFilter] = useState("")
  const [sortField, setSortField] = useState("fechaCreacion")
  const [sortDir, setSortDir] = useState("desc")

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (estadoFilter) params.set("estado", estadoFilter)
    if (prioridadFilter) params.set("prioridad", prioridadFilter)
    params.set("sortField", sortField)
    params.set("sortDir", sortDir)
    fetch(`/api/tickets?${params}`)
      .then(r => r.ok && r.json())
      .then(data => setTickets(data || []))
      .finally(() => setLoading(false))
  }, [search, estadoFilter, prioridadFilter, sortField, sortDir])

  const hasFilters = search || estadoFilter || prioridadFilter

  return (
    <div className="space-y-6">
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

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por asunto o código..."
              className="pl-10 rounded-xl h-10 bg-muted/30 border-0 focus-visible:bg-background focus-visible:border focus-visible:border-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-transparent px-3 text-sm min-w-[130px]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.filter(Boolean).map(e => (
              <option key={e} value={e}>{ESTADO_LABEL[e] || e}</option>
            ))}
          </select>
          <select
            value={prioridadFilter}
            onChange={e => setPrioridadFilter(e.target.value)}
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
              onClick={() => { setSearch(""); setEstadoFilter(""); setPrioridadFilter("") }}
            >
              <FilterX className="h-4 w-4" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <Th sortable field="codigo" current={sortField} dir={sortDir} onClick={f => { setSortField(f); setSortDir(d => sortField === f && d === "asc" ? "desc" : "asc") }}>Código</Th>
                <Th sortable field="asunto" current={sortField} dir={sortDir} onClick={f => { setSortField(f); setSortDir(d => sortField === f && d === "asc" ? "desc" : "asc") }}>Asunto</Th>
                <Th>Solicitante</Th>
                <Th className="text-center">Estado</Th>
                <Th className="text-center">Prioridad</Th>
                <Th>Asignado</Th>
                <Th className="text-right">Creado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-20 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tickets...</div>
                </td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <FileText className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No hay tickets</p>
                    <p className="text-xs text-muted-foreground/60">Crea tu primer ticket para comenzar</p>
                    <Link href="/tickets/new">
                      <Button variant="outline" size="sm" className="rounded-xl mt-1">Crear primer ticket</Button>
                    </Link>
                  </div>
                </td></tr>
              ) : (
                tickets.map(t => (
                  <tr
                    key={t.id}
                    className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer group"
                    onClick={() => window.location.href = `/tickets/${t.id}`}
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
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${ESTADO_BADGE[t.estado] || ESTADO_BADGE.NUEVO}`}>
                        {ESTADO_LABEL[t.estado] || t.estado}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${PRIORIDAD_BADGE[t.nivelPrioridad] || PRIORIDAD_BADGE.MEDIA}`}>
                        {t.nivelPrioridad}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">
                        {t.agente ? `${t.agente.nombre} ${t.agente.apellido}` : <span className="italic">Sin asignar</span>}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(t.fechaCreacion).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && tickets.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
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
