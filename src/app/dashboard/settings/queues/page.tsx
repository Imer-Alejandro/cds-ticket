"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Equipo { id: string; nombre: string }
interface Cola {
  id: string; nombre: string
  equipo: Equipo
  _count: { tickets: number; categorias: number }
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<Cola[]>([])
  const [teams, setTeams] = useState<Equipo[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newTeamId, setNewTeamId] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/queues").then(r => r.ok && r.json()).then(setQueues),
      fetch("/api/teams").then(r => r.ok && r.json()).then(setTeams),
    ]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName, equipoId: newTeamId })
      })
      if (res.ok) {
        setNewName(""); setNewTeamId("")
        const data = await fetch("/api/queues").then(r => r.json())
        setQueues(data)
      }
    } finally { setIsCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta cola?")) return
    await fetch(`/api/queues/${id}`, { method: "DELETE" })
    setQueues(queues.filter(q => q.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Colas</h2>
        <p className="text-muted-foreground">Gestiona las colas de atención asociadas a equipos.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Listado de Colas</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : queues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay colas configuradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Categorías</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map((cola) => (
                    <TableRow key={cola.id}>
                      <TableCell className="font-medium">{cola.nombre}</TableCell>
                      <TableCell>{cola.equipo.nombre}</TableCell>
                      <TableCell>{cola._count.categorias}</TableCell>
                      <TableCell>{cola._count.tickets}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(cola.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nueva Cola</CardTitle>
            <CardDescription>Crea una cola de atención asignada a un equipo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input placeholder="Ej. Soporte Nivel 1" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipo</label>
                <select required className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={newTeamId} onChange={e => setNewTeamId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Cola"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
