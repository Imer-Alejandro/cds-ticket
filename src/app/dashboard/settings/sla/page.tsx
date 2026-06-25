"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Categoria { id: string; nombre: string }
interface Sla {
  id: string; prioridad: string; minutosRespuesta: number; minutosResolucion: number
  categoria: Categoria
}

export default function SLAPage() {
  const [slas, setSlas] = useState<Sla[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ categoriaId: "", prioridad: "MEDIA", minutosRespuesta: "60", minutosResolucion: "480" })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/sla").then(r => r.ok && r.json()).then(setSlas),
      fetch("/api/categories").then(r => r.ok && r.json()).then(setCategories),
    ]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoriaId: form.categoriaId,
          prioridad: form.prioridad,
          minutosRespuesta: parseInt(form.minutosRespuesta),
          minutosResolucion: parseInt(form.minutosResolucion),
        })
      })
      if (res.ok) {
        const data = await fetch("/api/sla").then(r => r.json())
        setSlas(data)
        setForm({ categoriaId: "", prioridad: "MEDIA", minutosRespuesta: "60", minutosResolucion: "480" })
      }
    } finally { setIsCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla SLA?")) return
    await fetch(`/api/sla/${id}`, { method: "DELETE" })
    setSlas(slas.filter(s => s.id !== id))
  }

  const prioridadColor = (p: string) => {
    switch(p) {
      case 'CRITICA': return 'text-destructive'
      case 'ALTA': return 'text-orange-500'
      case 'MEDIA': return 'text-yellow-500'
      case 'BAJA': return 'text-green-500'
      default: return ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">SLAs</h2>
        <p className="text-muted-foreground">Define los acuerdos de nivel de servicio por categoría y prioridad.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Reglas SLA</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : slas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay reglas SLA configuradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Tiempo Respuesta</TableHead>
                    <TableHead>Tiempo Resolución</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slas.map((sla) => (
                    <TableRow key={sla.id}>
                      <TableCell className="font-medium">{sla.categoria.nombre}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${prioridadColor(sla.prioridad)}`}>{sla.prioridad}</span>
                      </TableCell>
                      <TableCell>{sla.minutosRespuesta} min</TableCell>
                      <TableCell>{sla.minutosResolucion} min</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(sla.id)}>
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
            <CardTitle>Nueva Regla SLA</CardTitle>
            <CardDescription>Configura los tiempos para una categoría y prioridad.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <select required className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.categoriaId} onChange={e => setForm({...form, categoriaId: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridad</label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                  <option value="CRITICA">Crítica</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tiempo de Respuesta (minutos)</label>
                <Input type="number" min="1" value={form.minutosRespuesta}
                  onChange={e => setForm({...form, minutosRespuesta: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tiempo de Resolución (minutos)</label>
                <Input type="number" min="1" value={form.minutosResolucion}
                  onChange={e => setForm({...form, minutosResolucion: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear SLA"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
