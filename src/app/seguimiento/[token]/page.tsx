"use client"

import { useEffect, useState } from "react"
import { Ticket as TicketIcon, Loader2, Clock, CalendarDays } from "lucide-react"

interface PublicTicket {
  codigo: string
  asunto: string
  descripcion: string
  estado: string
  nivelPrioridad: string
  fechaCreacion: string
  fechaResolucion: string | null
  fechaCierre: string | null
  categoria: { nombre: string } | null
}

interface PublicTicketResponse extends PublicTicket {
  error?: string
}

const ESTADO_LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  ASIGNADO: "Asignado",
  EN_PROGRESO: "En Progreso",
  PENDIENTE: "Pendiente",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
  ELIMINADO: "Eliminado",
}

const ESTADO_STYLE: Record<string, string> = {
  NUEVO: "bg-blue-100 text-blue-700 border-blue-200",
  ASIGNADO: "bg-indigo-100 text-indigo-700 border-indigo-200",
  EN_PROGRESO: "bg-amber-100 text-amber-700 border-amber-200",
  PENDIENTE: "bg-purple-100 text-purple-700 border-purple-200",
  RESUELTO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CERRADO: "bg-slate-100 text-slate-700 border-slate-200",
}

const PRIORIDAD_STYLE: Record<string, string> = {
  CRITICA: "bg-red-100 text-red-700 border-red-200",
  ALTA: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIA: "bg-yellow-100 text-yellow-700 border-yellow-200",
  BAJA: "bg-green-100 text-green-700 border-green-200",
}

function fecha(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })
}

export default function SeguimientoPage({ params }: { params: Promise<{ token: string }> }) {
  const [ticket, setTicket] = useState<PublicTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    params.then(({ token }) => {
      fetch(`/api/public/tickets/${token}`)
        .then(async (res) => {
          const data: PublicTicketResponse = await res.json()
          if (!res.ok) throw new Error(data.error || "No se pudo cargar el ticket")
          if (active) setTicket(data)
        })
        .catch((e) => active && setError(e instanceof Error ? e.message : "Error de conexión"))
        .finally(() => active && setLoading(false))
    })
    return () => { active = false }
  }, [params])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <TicketIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Help Desk IT</span>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Cargando estado del ticket...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900 mb-2">Enlace de seguimiento</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground/70 mt-4">
              Si recibiste este enlace por correo, verifica que la URL esté completa y correcta.
            </p>
          </div>
        )}

        {ticket && !loading && (
          <>
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Seguimiento de tu ticket</p>
                  <p className="text-lg font-bold text-white">{ticket.codigo}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${ESTADO_STYLE[ticket.estado] || ESTADO_STYLE.NUEVO}`}>
                  {ESTADO_LABEL[ticket.estado] || ticket.estado}
                </span>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{ticket.asunto}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PRIORIDAD_STYLE[ticket.nivelPrioridad] || PRIORIDAD_STYLE.MEDIA}`}>
                      {ticket.nivelPrioridad}
                    </span>
                    {ticket.categoria && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {ticket.categoria.nombre}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>Creado: <strong className="text-slate-900 font-medium">{fecha(ticket.fechaCreacion)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Resuelto: <strong className="text-slate-900 font-medium">{fecha(ticket.fechaResolucion)}</strong></span>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descripción</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Para agregar información a este ticket, responde al correo electrónico con el que recibiste este enlace.
            </p>
          </>
        )}
      </div>
    </div>
  )
}