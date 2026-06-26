"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, CheckCheck, Loader2, ChevronRight, Filter, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Notificacion {
  id: string; tipo: string; mensaje: string; leido: boolean; fecha: string
  ticket: { codigo: string; asunto: string }
}

const notifIcon: Record<string, string> = {
  NUEVO_TICKET: "🎫", CAMBIO_ESTADO: "🔄", ASIGNACION: "👤", NUEVO_COMENTARIO: "💬",
}

const notifLabel: Record<string, string> = {
  NUEVO_TICKET: "Nuevo Ticket", CAMBIO_ESTADO: "Cambio de Estado", ASIGNACION: "Asignación", NUEVO_COMENTARIO: "Nuevo Comentario",
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("todas")

  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotifs(data.notificaciones || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  const markRead = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n))
  }

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marcarTodas: true }) })
    setNotifs(prev => prev.map(n => ({ ...n, leido: true })))
  }

  const filtered = filter === "noLeidas" ? notifs.filter(n => !n.leido) :
    filter === "nuevoTicket" ? notifs.filter(n => n.tipo === "NUEVO_TICKET") :
    filter === "cambioEstado" ? notifs.filter(n => n.tipo === "CAMBIO_ESTADO") :
    filter === "asignacion" ? notifs.filter(n => n.tipo === "ASIGNACION") :
    filter === "comentario" ? notifs.filter(n => n.tipo === "NUEVO_COMENTARIO") :
    notifs

  const noLeidas = notifs.filter(n => !n.leido).length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Notificaciones</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="rounded-full shrink-0 h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centro de Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : "Todas las notificaciones están leídas"}
            </p>
          </div>
        </div>
        {noLeidas > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl gap-2">
            <CheckCheck className="h-4 w-4" /> Marcar todas leídas
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium mr-1"><Filter className="h-3.5 w-3.5 inline mr-1" />Filtrar:</span>
        {[
          { key: "todas", label: "Todas" },
          { key: "noLeidas", label: "No leídas" },
          { key: "nuevoTicket", label: "Nuevos tickets" },
          { key: "cambioEstado", label: "Cambios de estado" },
          { key: "asignacion", label: "Asignaciones" },
          { key: "comentario", label: "Comentarios" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
            }`}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {filter === "todas" ? "Todas las notificaciones" :
               filter === "noLeidas" ? "No leídas" :
               filter === "nuevoTicket" ? "Nuevos tickets" :
               filter === "cambioEstado" ? "Cambios de estado" :
               filter === "asignacion" ? "Asignaciones" : "Comentarios"}
              <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay notificaciones</p>
              <p className="text-xs mt-1">Las notificaciones aparecerán aquí cuando ocurran eventos en los tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(n => (
                <div key={n.id}
                  className={`flex items-start gap-4 px-2 py-4 rounded-xl transition-colors ${n.leido ? "" : "bg-accent/20"} hover:bg-accent/30 cursor-pointer`}
                  onClick={() => { markRead(n.id); router.push(`/tickets/${n.ticket?.codigo?.replace('TK-', '') || ''}`) }}
                >
                  <span className="text-xl mt-0.5 shrink-0">{notifIcon[n.tipo] || "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{notifLabel[n.tipo] || n.tipo}</span>
                      {!n.leido && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Nuevo</span>
                      )}
                      {n.ticket?.codigo && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{n.ticket.codigo}</span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${n.leido ? "text-muted-foreground" : "text-foreground font-medium"}`}>{n.mensaje}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.fecha).toLocaleString()}</p>
                  </div>
                  {!n.leido && (
                    <Button variant="ghost" size="sm" className="shrink-0 rounded-lg h-8" onClick={(e) => { e.stopPropagation(); markRead(n.id) }}>
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
