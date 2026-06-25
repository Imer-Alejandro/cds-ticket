"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Rol { id: string; nombre: string; permisos: Record<string, unknown>; _count?: { usuarios: number } }

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles")
      if (res.ok) setRoles(await res.json())
    } catch {
      console.error("Error fetching roles")
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRoles() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName })
      })
      if (res.ok) { setNewName(""); fetchRoles() }
    } finally { setIsCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este rol?")) return
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    fetchRoles()
  }

  const saveEdit = async (id: string) => {
    await fetch(`/api/roles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editName })
    })
    setEditingId(null); fetchRoles()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Roles</h2>
        <p className="text-muted-foreground">Gestiona los roles y permisos del sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Listado de Roles</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay roles registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((rol) => (
                    <TableRow key={rol.id}>
                      {editingId === rol.id ? (
                        <>
                          <TableCell>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>{rol._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-green-600" onClick={() => saveEdit(rol.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{rol.nombre}</TableCell>
                          <TableCell>{rol._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"
                                onClick={() => { setEditingId(rol.id); setEditName(rol.nombre) }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(rol.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuevo Rol</CardTitle>
            <CardDescription>Añade un nuevo rol al sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input placeholder="Ej. Técnico" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Rol"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
