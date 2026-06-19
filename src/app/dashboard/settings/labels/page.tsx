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

interface Etiqueta {
  id: string
  nombre: string
  color: string
  _count?: {
    tickets: number
  }
}

export default function LabelsPage() {
  const [labels, setLabels] = useState<Etiqueta[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#2563eb")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchLabels()
  }, [])

  const fetchLabels = async () => {
    try {
      const res = await fetch("/api/labels")
      if (res.ok) {
        const data = await res.json()
        setLabels(data)
      }
    } catch (error) {
      console.error("Error fetching labels", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName, color: newColor })
      })

      if (res.ok) {
        setNewName("")
        setNewColor("#2563eb")
        fetchLabels()
      }
    } catch (error) {
      console.error("Error creating label", error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Etiquetas</h2>
          <p className="text-muted-foreground">Gestiona las etiquetas (tags) personalizadas.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Etiquetas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay etiquetas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labels.map((label) => (
                    <TableRow key={label.id}>
                      <TableCell className="font-medium">
                        <span 
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: `${label.color}20`, color: label.color }}
                        >
                          {label.nombre}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: label.color }}></div>
                          <span className="text-sm text-muted-foreground">{label.color}</span>
                        </div>
                      </TableCell>
                      <TableCell>{label._count?.tickets || 0}</TableCell>
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
            <CardTitle>Nueva Etiqueta</CardTitle>
            <CardDescription>Crea un tag para agrupar tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input 
                  placeholder="Ej. VIP" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input 
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Etiqueta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
