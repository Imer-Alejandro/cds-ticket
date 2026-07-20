"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Filter, Clock } from "lucide-react"
import { useSocket, onNotificacion } from "@/hooks/useSocket"
import { playNotificationSound } from "@/lib/sound"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  useSocket()

  const loadTickets = async () => {
    try {
      const response = await fetch("/api/tickets")
      const data = await response.json()
      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  useEffect(() => {
    const unsubscribe = onNotificacion('nuevoTicket', (data: any) => {
      if (data?.ticket?.id) {
        setHighlightedId(data.ticket.id)
        playNotificationSound()
        setTimeout(() => setHighlightedId(null), 2500)
        loadTickets()
      }
    })

    return unsubscribe
  }, [])

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'NUEVO': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'EN_PROGRESO': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'AWAITING_APPROVAL': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'RESUELTO': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'CERRADO': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'CRITICA': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      case 'ALTA': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'
      case 'MEDIA': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
      case 'BAJA': return 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
    }
  }

  const displayTickets = tickets.length > 0 ? tickets : [
    {
      id: '1', codigo: 'INC-2024-001', asunto: 'La conexión VPN se cae constantemente', descripcion: '...', 
      categoria: { nombre: 'RED' }, fechaCreacion: '2024-03-10',
      solicitante: { nombre: 'Juan', apellido: 'Pérez' },
      agente: { nombre: 'María', apellido: 'García' },
      nivelPrioridad: 'ALTA', estado: 'EN_PROGRESO'
    },
    {
      id: '2', codigo: 'REQ-2024-042', asunto: 'Solicitud de nueva MacBook Pro', descripcion: '...', 
      categoria: { nombre: 'HARDWARE' }, fechaCreacion: '2024-03-09',
      solicitante: { nombre: 'Ana', apellido: 'López' },
      agente: { nombre: 'Carlos', apellido: 'Ruiz' },
      nivelPrioridad: 'MEDIA', estado: 'AWAITING_APPROVAL'
    },
    {
      id: '3', codigo: 'INC-2024-089', asunto: 'Outlook no sincroniza en el móvil', descripcion: '...', 
      categoria: { nombre: 'SOFTWARE' }, fechaCreacion: '2024-03-10',
      solicitante: { nombre: 'Pedro', apellido: 'Ramírez' },
      agente: { nombre: 'Laura', apellido: 'Mendoza' },
      nivelPrioridad: 'BAJA', estado: 'NUEVO'
    }
  ]

  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Tickets</h2>
          <p className="text-muted-foreground mt-1">Gestiona y da seguimiento a todas las solicitudes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-full bg-card hover:bg-muted/50 border-border h-10 px-4">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            Filtros
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              3
            </span>
          </Button>
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-10 px-6">
            <Plus className="mr-2 h-4 w-4" />
            Crear Ticket
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por ID, asunto o usuario..." 
              className="pl-9 bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-full h-10"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['Prioridad', 'Estado', 'Categoría', 'Agente'].map(filter => (
              <select key={filter} className="h-10 rounded-full border border-border bg-transparent px-4 py-2 text-sm text-foreground font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 pr-8 relative">
                <option>{filter}</option>
              </select>
            ))}
            <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 rounded-full px-4 h-10 font-medium">
              Limpiar todo
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[120px] font-semibold text-xs tracking-wider text-muted-foreground">CÓDIGO</TableHead>
                <TableHead className="min-w-[300px] font-semibold text-xs tracking-wider text-muted-foreground">ASUNTO</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider text-muted-foreground">SOLICITANTE</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider text-muted-foreground">AGENTE</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider text-muted-foreground text-center">PRIORIDAD</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider text-muted-foreground text-center">ESTADO</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider text-muted-foreground text-right pr-6">SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Cargando tickets...
                  </TableCell>
                </TableRow>
              ) : (
                displayTickets.map((ticket) => (
                  <TableRow key={ticket.id} className={`hover:bg-muted/30 transition-colors border-border/50 group ${highlightedId === ticket.id ? 'bg-amber-100/70 dark:bg-amber-900/20 animate-pulse' : ''}`}>
                    <TableCell className="font-medium text-primary">
                      {ticket.codigo}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-foreground mb-1">{ticket.asunto}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                        {ticket.categoria?.nombre || 'GENERAL'} • {new Date(ticket.fechaCreacion).toISOString().split('T')[0]}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {ticket.solicitante?.nombre?.charAt(0)}{ticket.solicitante?.apellido?.charAt(0)}
                        </div>
                        <span className="font-medium text-sm text-foreground">{ticket.solicitante?.nombre} {ticket.solicitante?.apellido}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {ticket.agente ? `${ticket.agente.nombre} ${ticket.agente.apellido}` : 'Sin asignar'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getPriorityColor(ticket.nivelPrioridad)}`}>
                        {ticket.nivelPrioridad}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(ticket.estado)}`}>
                        {ticket.estado.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5 text-red-600 font-bold text-sm">
                        <Clock className="h-4 w-4" />
                        2h 15m
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
