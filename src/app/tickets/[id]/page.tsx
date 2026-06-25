"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/useAuthStore"
import {
  ArrowLeft, MessageSquare, RotateCcw, Clock, User, Tag, AlertCircle,
  Send, Loader2, CheckCircle2, XCircle, ChevronRight, Ticket, Building2,
} from "lucide-react"

interface Ticket {
  id: string; codigo: string; asunto: string; descripcion: string
  estado: string; nivelPrioridad: string; origen: string
  fechaCreacion: string; fechaResolucion: string | null; fechaCierre: string | null
  solicitante: { id: string; nombre: string; apellido: string; correo: string }
  agente: { id: string; nombre: string; apellido: string } | null
  categoria: { id: string; nombre: string }
  cola: { id: string; nombre: string; equipo: { nombre: string } } | null
  sla: { id: string; prioridad: string; minutosRespuesta: number; minutosResolucion: number } | null
  comentarios: Comentario[]
  logs: Log[]
  etiquetas: { etiqueta: { id: string; nombre: string; color: string } }[]
}
interface Comentario { id: string; mensaje: string; esInterno: boolean; fecha: string; usuario: { nombre: string; apellido: string } }
interface Log { id: string; accion: string; valorAnterior?: string; valorNuevo?: string; fecha: string; usuario: { nombre: string; apellido: string } }

const TRANSICIONES: Record<string, { label: string; icon: typeof CheckCircle2; color: string }[]> = {
  NUEVO: [{ label: "Asignar", icon: User, color: "bg-amber-500 hover:bg-amber-600" }],
  ASIGNADO: [{ label: "Iniciar", icon: RotateCcw, color: "bg-blue-500 hover:bg-blue-600" }],
  EN_PROGRESO: [{ label: "Resolver", icon: CheckCircle2, color: "bg-emerald-500 hover:bg-emerald-600" }],
  RESUELTO: [{ label: "Cerrar", icon: XCircle, color: "bg-slate-500 hover:bg-slate-600" }],
  CERRADO: [],
}

const ESTADO: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NUEVO: { label: "Nuevo", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ASIGNADO: { label: "Asignado", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  EN_PROGRESO: { label: "En Progreso", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  RESUELTO: { label: "Resuelto", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  CERRADO: { label: "Cerrado", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
}

const PRIORIDAD: Record<string, { label: string; color: string }> = {
  CRITICA: { label: "Crítica", color: "text-red-600 bg-red-50 border-red-200" },
  ALTA: { label: "Alta", color: "text-orange-600 bg-orange-50 border-orange-200" },
  MEDIA: { label: "Media", color: "text-blue-600 bg-blue-50 border-blue-200" },
  BAJA: { label: "Baja", color: "text-green-600 bg-green-50 border-green-200" },
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [agents, setAgents] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/tickets/${params.id}`).then(r => r.ok && r.json()).then(setTicket).finally(() => setLoading(false))
    fetch("/api/users").then(r => r.ok && r.json()).then(data => setAgents(data || []))
  }, [params.id])

  const updateTicket = async (data: any) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await fetch(`/api/tickets/${params.id}`).then(r => r.json())
        setTicket(updated)
      } else {
        const err = await res.json()
        alert(err.error || "Error al actualizar")
      }
    } catch { alert("Error de conexión") }
    finally { setUpdating(false) }
  }

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: params.id, mensaje: comment, esInterno: isInternal }),
      })
      if (res.ok) {
        setComment("")
        const updated = await fetch(`/api/tickets/${params.id}`).then(r => r.json())
        setTicket(updated)
      }
    } catch { alert("Error al enviar comentario") }
    finally { setSending(false) }
  }

  const getDuration = (from: string, to?: string | null) => {
    const start = new Date(from).getTime()
    const end = to ? new Date(to).getTime() : Date.now()
    const mins = Math.floor((end - start) / 60000)
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando ticket...</div>
    </div>
  )
  if (!ticket) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <XCircle className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-lg font-medium">Ticket no encontrado</p>
      <Button variant="outline" onClick={() => router.push("/tickets")} className="rounded-xl">Volver a tickets</Button>
    </div>
  )

  const ec = ESTADO[ticket.estado] || ESTADO.NUEVO
  const pc = PRIORIDAD[ticket.nivelPrioridad] || PRIORIDAD.MEDIA
  const puedeEditar = user?.rolNombre === "Administrador"
  const trans = TRANSICIONES[ticket.estado] || []

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/tickets" className="hover:text-foreground transition-colors">Tickets</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{ticket.codigo}</span>
      </nav>

      {/* Header */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")} className="rounded-full shrink-0 -ml-2 h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{ticket.codigo}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${ec.bg} ${ec.text} ${ec.border}`}>{ec.label}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${pc.color}`}>{pc.label}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-2">{ticket.asunto}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{ticket.categoria.nombre}</span>
                {ticket.cola && <><span>·</span><span>{ticket.cola.nombre}</span></>}
                <span>·</span>
                <span>Creado {new Date(ticket.fechaCreacion).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {trans.length > 0 && (
            <div className="flex gap-2 shrink-0">
              {trans.map(a => (
                <Button
                  key={a.label}
                  size="sm"
                  disabled={updating}
                  onClick={() => updateTicket({
                    estado: a.label === "Asignar" ? "ASIGNADO" : a.label === "Iniciar" ? "EN_PROGRESO" : a.label === "Resolver" ? "RESUELTO" : "CERRADO",
                  })}
                  className={`rounded-xl gap-2 text-white shadow-sm ${a.color}`}
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <a.icon className="h-4 w-4" />}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Descripción</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 bg-muted/20 rounded-xl p-4 border border-border/30">
                {ticket.descripcion}
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Comentarios ({ticket.comentarios.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addComment} className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border/50">
                <textarea
                  value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Escribe un comentario..." rows={3}
                  className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                    <Tag className="h-3.5 w-3.5" /> Nota interna
                  </label>
                  <Button type="submit" size="sm" disabled={sending || !comment.trim()} className="rounded-xl gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Enviando..." : "Comentar"}
                  </Button>
                </div>
              </form>

              {ticket.comentarios.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin comentarios aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticket.comentarios.map(c => (
                    <div key={c.id} className={`rounded-xl border p-4 transition-colors ${
                      c.esInterno ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800" : "border-border/50"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {c.usuario.nombre.charAt(0)}{c.usuario.apellido.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{c.usuario.nombre} {c.usuario.apellido}</span>
                          {c.esInterno && (
                            <span className="text-[10px] font-semibold text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">
                              Interno
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(c.fecha).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.mensaje}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Historial</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {ticket.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin registros</p>
              ) : (
                <div className="space-y-0">
                  {ticket.logs.map((log, i) => (
                    <div key={log.id} className="flex gap-4 pb-4 relative">
                      {i < ticket.logs.length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />}
                      <div className="shrink-0">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{log.usuario.nombre} {log.usuario.apellido}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.accion === "CREACION" ? "creó el ticket" :
                             log.accion === "CAMBIO_ESTADO" ? "cambió el estado" :
                             log.accion === "ASIGNACION" ? "asignó el ticket" :
                             log.accion === "CAMBIO_PRIORIDAD" ? "cambió la prioridad" :
                             log.accion.toLowerCase().replace(/_/g, " ")}
                          </span>
                        </div>
                        {log.valorAnterior && log.valorNuevo && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            <span className="line-through">{log.valorAnterior}</span>
                            <span className="mx-1.5 text-muted-foreground/50">→</span>
                            <span className="font-medium">{log.valorNuevo}</span>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(log.fecha).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-primary/20" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Detalles</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <DR label="Código" value={ticket.codigo} mono />
              <DR label="Estado" value={ec.label} />
              <DR label="Prioridad" value={pc.label} />
              <DR label="Solicitante" value={`${ticket.solicitante.nombre} ${ticket.solicitante.apellido}`} />
              <DR label="Correo" value={ticket.solicitante.correo} />
              <DR label="Categoría" value={ticket.categoria.nombre} />
              <DR label="Cola" value={ticket.cola?.nombre || "Sin asignar"} />
              <DR label="Origen" value={ticket.origen === "WEB" ? "Web" : "Correo"} />
              <DR label="Creado" value={new Date(ticket.fechaCreacion).toLocaleString()} />
              {ticket.fechaResolucion && <DR label="Resuelto" value={new Date(ticket.fechaResolucion).toLocaleString()} />}
              {ticket.fechaCierre && <DR label="Cerrado" value={new Date(ticket.fechaCierre).toLocaleString()} />}
              <DR label="Tiempo abierto" value={getDuration(ticket.fechaCreacion, ticket.fechaResolucion || ticket.fechaCierre)} />
              {ticket.sla && (
                <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA</p>
                  <DR label="Respuesta" value={`${ticket.sla.minutosRespuesta} min`} />
                  <DR label="Resolución" value={`${ticket.sla.minutosResolucion} min`} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Asignación</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.agente ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {ticket.agente.nombre.charAt(0)}{ticket.agente.apellido.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ticket.agente.nombre} {ticket.agente.apellido}</p>
                    <p className="text-xs text-muted-foreground">Agente asignado</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-dashed border-border/50">
                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground italic">Sin agente asignado</p>
                </div>
              )}
              {puedeEditar && (
                <select
                  value={ticket.agente?.id || ""}
                  onChange={e => {
                    if (e.target.value) updateTicket({ agenteId: e.target.value, estado: ticket.estado === "NUEVO" ? "ASIGNADO" : undefined })
                  }}
                  className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">{ticket.agente ? "Reasignar..." : "Asignar agente..."}</option>
                  {agents.filter(a => a.id !== ticket.solicitante.id).map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {/* Priority */}
          {puedeEditar && (
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Cambiar Prioridad</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRIORIDAD).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => key !== ticket.nivelPrioridad && updateTicket({ nivelPrioridad: key })}
                      disabled={key === ticket.nivelPrioridad}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-medium text-center transition-all ${
                        key === ticket.nivelPrioridad
                          ? `${val.color} ring-2 ring-offset-1`
                          : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >{val.label}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {ticket.etiquetas.length > 0 && (
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Etiquetas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {ticket.etiquetas.map(te => (
                    <span key={te.etiqueta.id}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"
                      style={{ backgroundColor: `${te.etiqueta.color}18`, color: te.etiqueta.color, borderColor: `${te.etiqueta.color}40` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: te.etiqueta.color }} />
                      {te.etiqueta.nombre}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function DR({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? "font-mono" : "font-medium"} max-w-[60%] truncate`}>{value}</span>
    </div>
  )
}
