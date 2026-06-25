"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Usuario { id: string; nombre: string; apellido: string; correo?: string }
interface Equipo {
  id: string; nombre: string
  supervisor: Usuario
  miembros: { usuario: Usuario }[]
  colas: { id: string; nombre: string }[]
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Equipo[]>([])
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then(r => r.ok && r.json()).then(setTeams),
      fetch("/api/users").then(r => r.ok && r.json()).then(setUsers),
    ]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName, supervisorId, miembros: selectedMembers })
      })
      if (res.ok) {
        setShowForm(false)
        setNewName(""); setSupervisorId(""); setSelectedMembers([])
        const data = await fetch("/api/teams").then(r => r.json())
        setTeams(data)
      }
    } finally { setIsCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este equipo?")) return
    await fetch(`/api/teams/${id}`, { method: "DELETE" })
    setTeams(teams.filter(t => t.id !== id))
  }

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Equipos</h2>
          <p className="text-muted-foreground">Gestiona los equipos de trabajo y sus miembros.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? "Cancelar" : "Nuevo Equipo"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Equipo</CardTitle>
            <CardDescription>Crea un equipo con supervisor y miembros.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Equipo</label>
                <Input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Soporte Técnico" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervisor</label>
                <select required className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={supervisorId} onChange={e => setSupervisorId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {users.filter(u => u.id).map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Miembros</label>
                <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)} />
                      {u.nombre} {u.apellido} ({u.correo})
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={isCreating}>{isCreating ? "Guardando..." : "Crear Equipo"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Listado de Equipos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay equipos registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Colas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((equipo) => (
                  <TableRow key={equipo.id}>
                    <TableCell className="font-medium">{equipo.nombre}</TableCell>
                    <TableCell>{equipo.supervisor.nombre} {equipo.supervisor.apellido}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{equipo.miembros.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>{equipo.colas.map(c => c.nombre).join(", ") || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(equipo.id)}>
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
    </div>
  )
}
