"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
  _count?: {
    tickets: number
  }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories", error)
    } finally {
      setLoading(false)
    }
  }

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
        setNewName("")
        setNewDesc("")
        fetchCategories()
      }
    } catch (error) {
      console.error("Error creating category", error)
    } finally {
      setIsCreating(false)
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
          <CardHeader>
            <CardTitle>Listado de Categorías</CardTitle>
          </CardHeader>
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
                      <TableCell className="font-medium">{cat.nombre}</TableCell>
                      <TableCell>{cat.descripcion || "-"}</TableCell>
                      <TableCell>{cat._count?.tickets || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            <CardTitle>Nueva Categoría</CardTitle>
            <CardDescription>Añade una nueva categoría para clasificar tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input 
                  placeholder="Ej. Hardware" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Input 
                  placeholder="Opcional" 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
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
