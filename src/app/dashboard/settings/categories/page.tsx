"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
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
  palabrasClave: string | null
  colaDefaultId: string | null
  colaDefault?: { id: string; nombre: string } | null
  _count?: { tickets: number }
}

interface Cola {
  id: string
  nombre: string
  equipo?: { id: string; nombre: string } | null
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categoria[]>([])
  const [queues, setQueues] = useState<Cola[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newKeywords, setNewKeywords] = useState("")
  const [newCola, setNewCola] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editKeywords, setEditKeywords] = useState("")
  const [editCola, setEditCola] = useState("")

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

  const fetchQueues = async () => {
    try {
      const res = await fetch("/api/queues")
      if (res.ok) setQueues(await res.json())
    } catch {
      console.error("Error fetching queues")
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchQueues()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newName,
          descripcion: newDesc,
          palabrasClave: newKeywords,
          colaDefaultId: newCola || null
        })
      })
      if (res.ok) {
        setNewName(""); setNewDesc(""); setNewKeywords(""); setNewCola(""); fetchCategories()
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
    setEditKeywords(cat.palabrasClave || "")
    setEditCola(cat.colaDefaultId || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditDesc("")
    setEditKeywords("")
    setEditCola("")
  }

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editName,
          descripcion: editDesc,
          palabrasClave: editKeywords,
          colaDefaultId: editCola || null
        })
      })
      if (res.ok) { cancelEdit(); fetchCategories() }
    } catch (error) {
      console.error("Error updating category", error)
    }
  }

  const nombreCola = (cat: Categoria) => {
    if (cat.colaDefault?.nombre) return cat.colaDefault.nombre
    return queues.find((q) => q.id === cat.colaDefaultId)?.nombre || ""
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Categorías</h2>
          <p className="text-muted-foreground">Gestiona las categorías de tickets, sus palabras clave para auto-clasificar y la cola por defecto.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
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
                    <TableHead>Palabras clave</TableHead>
                    <TableHead>Cola por defecto</TableHead>
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
                          <TableCell>
                            <Input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} className="h-8" placeholder="Coma separadas" />
                          </TableCell>
                          <TableCell>
                            <Select value={editCola} onChange={(e) => setEditCola(e.target.value)} className="h-8">
                              <option value="">Sin cola</option>
                              {queues.map((q) => (
                                <option key={q.id} value={q.id}>{q.nombre}</option>
                              ))}
                            </Select>
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
                          <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{cat.palabrasClave || "-"}</TableCell>
                          <TableCell>{nombreCola(cat) || "-"}</TableCell>
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
            <CardDescription>Añade una categoría y sus palabras clave para la auto-clasificación automática.</CardDescription>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Palabras clave</label>
                <Input placeholder="Ej. teclado, monitor, impresora" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} />
                <p className="text-xs text-muted-foreground">Separadas por comas. Se buscan en el asunto y la descripción del correo/ticket para auto-clasificar.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cola por defecto</label>
                <Select value={newCola} onChange={(e) => setNewCola(e.target.value)}>
                  <option value="">Sin cola</option>
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>{q.nombre}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">Determina el equipo y supervisor asignados por la auto-clasificación.</p>
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