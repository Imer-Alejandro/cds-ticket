"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/useAuthStore"
import {
  ArrowLeft, MessageSquare, RotateCcw, User, Tag, AlertCircle,
  Send, Loader2, CheckCircle2, XCircle, ChevronRight, Ticket,
  Paperclip, Clock, UserCheck, Play, History, FileText,
  ChevronDown, Sparkles,
} from "lucide-react"

interface AdjuntoData { id: string; nombre: string; tipo: string; url: string; data: string | null; tamaño: number | null }
interface Ticket {
  id: string; codigo: string; asunto: string; descripcion: string
  estado: string; nivelPrioridad: string; origen: string
  solicitanteId: string
  fechaCreacion: string; fechaResolucion: string | null; fechaCierre: string | null
  solicitante: { id: string; nombre: string; apellido: string; correo: string }
  agente: { id: string; nombre: string; apellido: string } | null
  categoria: { id: string; nombre: string }
  cola: { id: string; nombre: string; equipo: { nombre: string } } | null
  sla: { id: string; prioridad: string; minutosRespuesta: number; minutosResolucion: number } | null
  comentarios: Comentario[]; logs: Log[]; etiquetas: { etiqueta: { id: string; nombre: string; color: string } }[]
  adjuntos: AdjuntoData[]
}
interface Comentario { id: string; mensaje: string; esInterno: boolean; fecha: string; usuario: { id: string; nombre: string; apellido: string }; adjuntos: AdjuntoData[] }
interface Log { id: string; accion: string; valorAnterior?: string; valorNuevo?: string; fecha: string; usuario: { nombre: string; apellido: string } }

interface Plantilla { id: string; titulo: string; contenido: string; categoriaId: string | null; esGlobal: boolean }

const ESTADOS: Record<string, { label: string; desc: string; color: string; light: string }> = {
  NUEVO: { label: "Nuevo", desc: "Pendiente de asignación", color: "text-blue-600 bg-blue-50 border-blue-200", light: "bg-blue-500" },
  ASIGNADO: { label: "Asignado", desc: "Agente asignado, pendiente de inicio", color: "text-amber-600 bg-amber-50 border-amber-200", light: "bg-amber-500" },
  EN_PROGRESO: { label: "En Progreso", desc: "En proceso de resolución", color: "text-orange-600 bg-orange-50 border-orange-200", light: "bg-orange-500" },
  RESUELTO: { label: "Resuelto", desc: "Solución aplicada, esperando confirmación", color: "text-emerald-600 bg-emerald-50 border-emerald-200", light: "bg-emerald-500" },
  CERRADO: { label: "Cerrado", desc: "Ticket finalizado", color: "text-slate-600 bg-slate-100 border-slate-200", light: "bg-slate-400" },
}

const PRIORIDAD: Record<string, { label: string; color: string }> = {
  CRITICA: { label: "Crítica", color: "text-red-600 bg-red-50 border-red-200" },
  ALTA: { label: "Alta", color: "text-orange-600 bg-orange-50 border-orange-200" },
  MEDIA: { label: "Media", color: "text-blue-600 bg-blue-50 border-blue-200" },
  BAJA: { label: "Baja", color: "text-green-600 bg-green-50 border-green-200" },
}

type Accion = { label: string; icon: any; action: string; color: string; desc: string; role: string }

const ACCIONES: Record<string, Accion[]> = {
  NUEVO: [
    { label: "Asignarme", icon: UserCheck, action: "TOMADO", color: "bg-amber-500 hover:bg-amber-600", desc: "Tomar el ticket y empezar a trabajar", role: "agente" },
    { label: "Asignar a...", icon: User, action: "ASIGNADO", color: "bg-slate-500 hover:bg-slate-600", desc: "Asignar a otro agente", role: "admin" },
  ],
  ASIGNADO: [
    { label: "Iniciar", icon: Play, action: "EN_PROGRESO", color: "bg-blue-500 hover:bg-blue-600", desc: "Comenzar a trabajar en el ticket", role: "todos" },
  ],
  EN_PROGRESO: [
    { label: "Resolver", icon: CheckCircle2, action: "RESUELTO", color: "bg-emerald-500 hover:bg-emerald-600", desc: "Marcar como resuelto", role: "todos" },
  ],
  RESUELTO: [
    { label: "Cerrar", icon: XCircle, action: "CERRADO", color: "bg-slate-500 hover:bg-slate-600", desc: "Confirmar y cerrar ticket", role: "todos" },
    { label: "Reabrir", icon: RotateCcw, action: "EN_PROGRESO", color: "bg-orange-500 hover:bg-orange-600", desc: "Volver a abrir el ticket", role: "admin" },
  ],
  CERRADO: [
    { label: "Reabrir", icon: RotateCcw, action: "EN_PROGRESO", color: "bg-orange-500 hover:bg-orange-600", desc: "Reabrir ticket cerrado", role: "admin" },
  ],
}

export default function TicketDetailPage() {
  const params = useParams(); const router = useRouter(); const { user } = useAuthStore()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [agents, setAgents] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [showPlantillas, setShowPlantillas] = useState(false)

  const esAgente = user?.rolNombre === "Administrador" || user?.rolNombre === "Agente"
  const esAdmin = user?.rolNombre === "Administrador"
  const esSolicitante = ticket?.solicitanteId === user?.id
  const esAgenteAsignado = ticket?.agente?.id === user?.id

  useEffect(() => {
    if (!params.id) return
    Promise.all([
      fetch(`/api/tickets/${params.id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/users").then(r => r.ok ? r.json() : []),
    ]).then(([t, a]) => { setTicket(t); setAgents(a || []) }).finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    if (!ticket) return
    fetch(`/api/templates?categoriaId=${ticket.categoria.id}`).then(r => r.ok && r.json()).then(d => setPlantillas(d || []))
  }, [ticket])

  const puedeAccion = (accion: Accion) => {
    if (accion.role === "admin") return esAdmin
    if (accion.role === "agente") return esAgente
    return esAgente || esAgenteAsignado || esAdmin
  }

  const updateTicket = async (data: any) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (res.ok) {
        const updated = await fetch(`/api/tickets/${params.id}`).then(r => r.json())
        setTicket(updated)
      } else { const err = await res.json(); alert(err.error || "Error") }
    } catch { alert("Error de conexión") } finally { setUpdating(false) }
  }

  const readFileAsBase64 = (f: File): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const result = r.result as string; res(result.split(',')[1] || '') }; r.onerror = rej; r.readAsDataURL(f) })

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSending(true)
    try {
      const adjuntos = await Promise.all(commentFiles.map(f => readFileAsBase64(f).then(data => ({ nombre: f.name, tipo: f.type, tamaño: f.size, data, url: '' }))))
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: params.id, mensaje: comment, esInterno: isInternal, adjuntos }) })
      if (res.ok) { setComment(""); setCommentFiles([]); const updated = await fetch(`/api/tickets/${params.id}`).then(r => r.json()); setTicket(updated) }
    } catch { alert("Error al enviar comentario") } finally { setSending(false) }
  }

  const insertPlantilla = (p: Plantilla) => { setComment(p.contenido); setShowPlantillas(false) }

  const getDuration = (from: string, to?: string | null) => {
    const mins = Math.floor(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60000)
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

  const ec = ESTADOS[ticket.estado] || ESTADOS.NUEVO
  const pc = PRIORIDAD[ticket.nivelPrioridad] || PRIORIDAD.MEDIA
  const acciones = ACCIONES[ticket.estado]?.filter(a => puedeAccion(a)) || []

  return (
    <div className="space-y-6 max-w-6xl px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Breadcrumb sutil */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/tickets" className="hover:text-foreground transition-colors">Tickets</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{ticket.codigo}</span>
      </nav>

      {/* Header principal */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${ec.light}, ${pc.color.split(' ')[0].replace('text-', '')}88)` }} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")} className="rounded-full shrink-0 -ml-2 h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">{ticket.codigo}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${ec.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ec.light}`} />
                    {ec.label}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold border ${pc.color}`}>{pc.label}</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight mt-2">{ticket.asunto}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  {ticket.categoria.nombre}{ticket.cola ? ` · ${ticket.cola.nombre}` : ""} · Creado {new Date(ticket.fechaCreacion).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de acciones */}
          {acciones.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border/50">
              <span className="text-xs font-medium text-muted-foreground mr-1">Acciones:</span>
              {acciones.map(a => (
                <Button key={a.action} size="sm" disabled={updating} title={a.desc}
                  onClick={() => {
                    if (a.action === "TOMADO") {
                      updateTicket({ agenteId: user?.id, estado: "EN_PROGRESO" })
                    } else {
                      updateTicket({ estado: a.action })
                    }
                  }}
                  className={`rounded-xl gap-1.5 text-white shadow-xs text-xs ${a.color}`}
                >
                  {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <CardTitle className="text-sm font-semibold">Descripción</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 bg-muted/20 rounded-xl p-4 border border-border/30">{ticket.descripcion}</div>
              {ticket.adjuntos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ticket.adjuntos.map(a => <AdjuntoBadge key={a.id} a={a} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comentarios */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <CardTitle className="text-sm font-semibold">Comentarios ({ticket.comentarios.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulario de comentario */}
              {esAgente && (
                <form onSubmit={addComment} className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                        <Tag className="h-3 w-3" /> Interno
                      </label>
                      {plantillas.length > 0 && (
                        <div className="relative">
                          <button type="button" onClick={() => setShowPlantillas(!showPlantillas)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded-lg hover:bg-muted/50"
                          >
                            <Sparkles className="h-3 w-3" /> Respuesta rápida <ChevronDown className="h-3 w-3" />
                          </button>
                          {showPlantillas && (
                            <div className="absolute top-full left-0 mt-1 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                              {plantillas.map(p => (
                                <button key={p.id} type="button" onClick={() => insertPlantilla(p)}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent border-b border-border/50 last:border-0"
                                >
                                  <span className="font-medium">{p.titulo}</span>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{p.contenido}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      <Paperclip className="h-3 w-3" />
                      <span>{commentFiles.length > 0 ? `${commentFiles.length} archivo(s)` : "Adjuntar"}</span>
                      <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setCommentFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                    </label>
                  </div>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder={isInternal ? "Nota interna (solo visible para agentes/admin)..." : "Escribe un comentario..."}
                    rows={3}
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(commentFiles).map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-muted/50 border border-border/50 px-2 py-1 text-xs">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[100px] truncate">{f.name}</span>
                          <button type="button" onClick={() => setCommentFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={sending || !comment.trim()} className="rounded-xl gap-2">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Lista de comentarios */}
              {ticket.comentarios.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin comentarios aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticket.comentarios.filter(c => !c.esInterno || esAgente).map(c => (
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
                            <span className="text-[10px] font-semibold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">Interno</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(c.fecha).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.mensaje}</p>
                      {c.adjuntos?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">{c.adjuntos.map(a => <AdjuntoBadge key={a.id} a={a} />)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial compacto */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center"><History className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <CardTitle className="text-sm font-semibold">Actividad</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {ticket.logs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sin registros</p> : (
                <div className="space-y-0">
                  {[...ticket.logs].reverse().map((log, i) => (
                    <div key={log.id} className="flex gap-3 pb-3 relative">
                      {i < ticket.logs.length - 1 && <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border/50" />}
                      <div className="shrink-0 mt-0.5">
                        <div className={`h-[18px] w-[18px] rounded-full flex items-center justify-center ${
                          log.accion === "CREACION" ? "bg-blue-100" :
                          log.accion === "CAMBIO_ESTADO" ? "bg-amber-100" :
                          log.accion === "ASIGNACION" ? "bg-purple-100" :
                          log.accion === "CAMBIO_PRIORIDAD" ? "bg-red-100" : "bg-muted"
                        }`}>
                          <div className={`h-2 w-2 rounded-full ${
                            log.accion === "CREACION" ? "bg-blue-500" :
                            log.accion === "CAMBIO_ESTADO" ? "bg-amber-500" :
                            log.accion === "ASIGNACION" ? "bg-purple-500" :
                            log.accion === "CAMBIO_PRIORIDAD" ? "bg-red-500" : "bg-muted-foreground"
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">{log.usuario.nombre} {log.usuario.apellido}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.accion === "CREACION" ? "creó el ticket" :
                             log.accion === "CAMBIO_ESTADO" ? "cambió el estado" :
                             log.accion === "ASIGNACION" ? "asignó el ticket" :
                             log.accion === "CAMBIO_PRIORIDAD" ? "cambió la prioridad" :
                             log.accion.toLowerCase().replace(/_/g, " ")}
                          </span>
                        </div>
                        {log.valorAnterior && log.valorNuevo && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="line-through opacity-60">{log.valorAnterior}</span>
                            <span className="mx-1 text-muted-foreground/40">→</span>
                            <span className="font-medium">{log.valorNuevo}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{new Date(log.fecha).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Estado actual */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <div className={`h-1.5 ${ec.light}`} />
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  ticket.estado === "NUEVO" ? "bg-blue-100" :
                  ticket.estado === "ASIGNADO" ? "bg-amber-100" :
                  ticket.estado === "EN_PROGRESO" ? "bg-orange-100" :
                  ticket.estado === "RESUELTO" ? "bg-emerald-100" : "bg-slate-100"
                }`}>
                  {ticket.estado === "NUEVO" ? <Ticket className="h-5 w-5 text-blue-600" /> :
                   ticket.estado === "ASIGNADO" ? <User className="h-5 w-5 text-amber-600" /> :
                   ticket.estado === "EN_PROGRESO" ? <RotateCcw className="h-5 w-5 text-orange-600" /> :
                   ticket.estado === "RESUELTO" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                   <XCircle className="h-5 w-5 text-slate-600" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{ec.label}</p>
                  <p className="text-xs text-muted-foreground">{ec.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Abierto hace {getDuration(ticket.fechaCreacion)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Asignación */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asignación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {ticket.solicitante.nombre.charAt(0)}{ticket.solicitante.apellido.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{ticket.solicitante.nombre} {ticket.solicitante.apellido}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{ticket.solicitante.correo}</p>
                  <p className="text-[10px] text-muted-foreground">Solicitante</p>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              {ticket.agente ? (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber/10 text-amber-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {ticket.agente.nombre.charAt(0)}{ticket.agente.apellido.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{ticket.agente.nombre} {ticket.agente.apellido}</p>
                    <p className="text-[10px] text-muted-foreground">Agente asignado</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin agente asignado</p>
              )}
              {esAgente && (
                <select value={ticket.agente?.id || ""}
                  onChange={e => { if (e.target.value) updateTicket({ agenteId: e.target.value, estado: ticket.estado === "NUEVO" ? "ASIGNADO" : undefined }) }}
                  className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-xs"
                >
                  <option value="">{ticket.agente ? "Reasignar..." : "Asignar agente..."}</option>
                  {agents.filter(a => a.id !== ticket.solicitante.id).map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {/* Detalles */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <DR label="Código" value={ticket.codigo} mono />
              <DR label="Prioridad" value={
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${pc.color}`}>{pc.label}</span>
              } />
              <DR label="Categoría" value={ticket.categoria.nombre} />
              <DR label="Cola" value={ticket.cola?.nombre || "—"} />
              <DR label="Origen" value={ticket.origen === "WEB" ? "Web" : "Correo"} />
              {ticket.fechaResolucion && <DR label="Resuelto" value={new Date(ticket.fechaResolucion).toLocaleString()} />}
              {ticket.fechaCierre && <DR label="Cerrado" value={new Date(ticket.fechaCierre).toLocaleString()} />}
              <DR label="Tiempo" value={getDuration(ticket.fechaCreacion, ticket.fechaResolucion || ticket.fechaCierre)} />
            </CardContent>
          </Card>

          {/* Prioridad */}
          {esAdmin && (
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cambiar Prioridad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(PRIORIDAD).map(([key, val]) => (
                    <button key={key} onClick={() => key !== ticket.nivelPrioridad && updateTicket({ nivelPrioridad: key })}
                      disabled={key === ticket.nivelPrioridad}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-medium text-center transition-all ${
                        key === ticket.nivelPrioridad ? `${val.color} ring-2 ring-offset-1` : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >{val.label}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Etiquetas */}
          {ticket.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ticket.etiquetas.map(te => (
                <span key={te.etiqueta.id} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border"
                  style={{ backgroundColor: `${te.etiqueta.color}18`, color: te.etiqueta.color, borderColor: `${te.etiqueta.color}40` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: te.etiqueta.color }} />
                  {te.etiqueta.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* Componentes auxiliares */

function AdjuntoBadge({ a }: { a: AdjuntoData }) {
  const download = () => {
    if (a.data) { const l = document.createElement('a'); l.href = `data:${a.tipo};base64,${a.data}`; l.download = a.nombre; l.click(); l.remove() }
    else if (a.url) window.open(a.url, '_blank')
  }
  const isImg = a.tipo?.startsWith('image/')
  return (
    <button type="button" onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs hover:bg-muted/40 transition-colors group"
    >
      {isImg ? (
        <img src={`data:${a.tipo};base64,${a.data}`} alt={a.nombre} className="h-5 w-5 rounded object-cover" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
      )}
      <span className="max-w-[140px] truncate">{a.nombre}</span>
      {a.tamaño && <span className="text-[10px] text-muted-foreground">({(a.tamaño / 1024).toFixed(0)} KB)</span>}
    </button>
  )
}

function DR({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right max-w-[60%] truncate ${mono ? "font-mono font-medium" : ""}`}>{value}</span>
    </div>
  )
}
