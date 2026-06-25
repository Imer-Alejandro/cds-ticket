"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"

interface Departamento {
  id: string
  nombre: string
  descripcion: string | null
  _count?: { usuarios: number }
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [newDeptName, setNewDeptName] = useState("")
  const [newDeptDesc, setNewDeptDesc] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments")
      if (res.ok) setDepartments(await res.json())
    } catch {
      console.error("Error fetching departments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDepartments() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newDeptName, descripcion: newDeptDesc })
      })
      if (res.ok) {
        setNewDeptName(""); setNewDeptDesc(""); fetchDepartments()
      }
    } catch (error) {
      console.error("Error creating department", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este departamento?")) return
    try {
      await fetch(`/api/departments/${id}`, { method: "DELETE" })
      fetchDepartments()
    } catch (error) {
      console.error("Error deleting department", error)
    }
  }

  const startEdit = (dept: Departamento) => {
    setEditingId(dept.id)
    setEditName(dept.nombre)
    setEditDesc(dept.descripcion || "")
  }

  const cancelEdit = () => {
    setEditingId(null); setEditName(""); setEditDesc("")
  }

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editName, descripcion: editDesc })
      })
      if (res.ok) { cancelEdit(); fetchDepartments() }
    } catch (error) {
      console.error("Error updating department", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Departamentos</h2>
          <p className="text-muted-foreground">Gestiona los departamentos de la empresa.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Listado de Departamentos</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay departamentos registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      {editingId === dept.id ? (
                        <>
                          <TableCell>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8" placeholder="Opcional" />
                          </TableCell>
                          <TableCell>{dept._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-green-600" onClick={() => saveEdit(dept.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={cancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{dept.nombre}</TableCell>
                          <TableCell>{dept.descripcion || "-"}</TableCell>
                          <TableCell>{dept._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => startEdit(dept)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(dept.id)}>
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
            <CardTitle>Nuevo Departamento</CardTitle>
            <CardDescription>Añade un nuevo departamento al sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input placeholder="Ej. Recursos Humanos" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Input placeholder="Opcional" value={newDeptDesc} onChange={(e) => setNewDeptDesc(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Departamento"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
