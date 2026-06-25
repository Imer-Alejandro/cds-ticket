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

interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
  _count?: { tickets: number }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) setCategories(await res.json())
    } catch {
      console.error("Error fetching categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName, descripcion: newDesc })
      })
      if (res.ok) {
        setNewName(""); setNewDesc(""); fetchCategories()
      }
    } catch (error) {
      console.error("Error creating category", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" })
      fetchCategories()
    } catch (error) {
      console.error("Error deleting category", error)
    }
  }

  const startEdit = (cat: Categoria) => {
    setEditingId(cat.id)
    setEditName(cat.nombre)
    setEditDesc(cat.descripcion || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditDesc("")
  }

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editName, descripcion: editDesc })
      })
      if (res.ok) { cancelEdit(); fetchCategories() }
    } catch (error) {
      console.error("Error updating category", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Categorías</h2>
          <p className="text-muted-foreground">Gestiona las categorías de tickets.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Listado de Categorías</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay categorías registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      {editingId === cat.id ? (
                        <>
                          <TableCell>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8" placeholder="Opcional" />
                          </TableCell>
                          <TableCell>{cat._count?.tickets || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-green-600" onClick={() => saveEdit(cat.id)}>
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
                          <TableCell className="font-medium">{cat.nombre}</TableCell>
                          <TableCell>{cat.descripcion || "-"}</TableCell>
                          <TableCell>{cat._count?.tickets || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => startEdit(cat)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(cat.id)}>
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
            <CardTitle>Nueva Categoría</CardTitle>
            <CardDescription>Añade una nueva categoría para clasificar tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input placeholder="Ej. Hardware" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Input placeholder="Opcional" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Categoría"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
