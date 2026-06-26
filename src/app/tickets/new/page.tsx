"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/store/useAuthStore"
import { ArrowLeft, Send, AlertCircle, Loader2, FileText, Tag, Ticket, ChevronRight, Paperclip, X } from "lucide-react"

interface Categoria { id: string; nombre: string; descripcion: string | null }

const PRIORIDADES = [
  { value: "BAJA", label: "Baja", desc: "Poco urgente", color: "border-green-200 bg-green-50 text-green-700", ring: "ring-green-400" },
  { value: "MEDIA", label: "Media", desc: "Urgencia normal", color: "border-blue-200 bg-blue-50 text-blue-700", ring: "ring-blue-400" },
  { value: "ALTA", label: "Alta", desc: "Requiere atención", color: "border-orange-200 bg-orange-50 text-orange-700", ring: "ring-orange-400" },
  { value: "CRITICA", label: "Crítica", desc: "Bloqueante", color: "border-red-200 bg-red-50 text-red-700", ring: "ring-red-400" },
]

export default function NewTicketPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loadingCat, setLoadingCat] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ asunto: "", descripcion: "", categoriaId: "", nivelPrioridad: "MEDIA" })
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.ok && r.json())
      .then(data => { setCategories(data || []); setLoadingCat(false) })
      .catch(() => setLoadingCat(false))
  }, [])

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1] || '')
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return router.push("/login")
    if (!form.asunto.trim()) { setError("El asunto es obligatorio"); return }
    if (!form.descripcion.trim()) { setError("La descripción es obligatoria"); return }
    if (!form.categoriaId) { setError("Selecciona una categoría"); return }
    setSaving(true); setError("")
    try {
      const adjuntos = await Promise.all(
        files.map(async (f) => ({
          nombre: f.name,
          tipo: f.type,
          tamaño: f.size,
          data: await readFileAsBase64(f),
          url: '',
        }))
      )
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, solicitanteId: user.id, adjuntos }),
      })
      if (res.ok) {
        const ticket = await res.json()
        router.push(`/tickets/${ticket.id}`)
      } else {
        const err = await res.json()
        setError(err.error || "Error al crear ticket")
      }
    } catch { setError("Error de conexión al crear ticket") }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/tickets" className="hover:text-foreground transition-colors">Tickets</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Nuevo Ticket</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0 h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Ticket className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Ticket</h1>
          <p className="text-sm text-muted-foreground">Reporta un incidente o solicitud de soporte técnico</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button className="text-red-500 hover:text-red-700 font-medium text-xs" onClick={() => setError("")}>Cerrar</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main form */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-primary/20" />
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/50">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Información del Ticket</h2>
                    <p className="text-xs text-muted-foreground">Describe el problema o solicitud</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    Asunto <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required value={form.asunto}
                    onChange={e => setForm({ ...form, asunto: e.target.value })}
                    placeholder="Ej. No puedo acceder al correo corporativo"
                    className="rounded-xl h-11"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground text-right">{form.asunto.length}/200</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    Descripción <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    required value={form.descripcion}
                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Describe el problema en detalle. Incluye pasos para reproducirlo, mensajes de error, etc."
                    rows={6}
                    className="flex w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm resize-y min-h-[140px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">{form.descripcion.length}/2000</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Adjuntos
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/40 transition-colors">
                    <Paperclip className="h-5 w-5 shrink-0" />
                    <span>Haz clic para seleccionar archivos o arrastra y suelta</span>
                    <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                  </label>
                  {files.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {Array.from(files).map((f, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-destructive ml-2">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-amber-200" />
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/50">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Tag className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Clasificación</h2>
                    <p className="text-xs text-muted-foreground">Categoría y prioridad del ticket</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    Categoría <span className="text-destructive">*</span>
                  </label>
                  {loadingCat ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground h-11 px-3 rounded-xl border border-dashed border-border">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando categorías...
                    </div>
                  ) : (
                    <select
                      required value={form.categoriaId}
                      onChange={e => setForm({ ...form, categoriaId: e.target.value })}
                      className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <div className="space-y-2">
                    {PRIORIDADES.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm({ ...form, nivelPrioridad: p.value })}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                          form.nivelPrioridad === p.value
                            ? `${p.color} ring-2 ring-offset-1 ${p.ring}`
                            : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground/50"
                        }`}
                      >
                        <span className="text-sm font-medium">{p.label}</span>
                        <span className="text-xs opacity-70 ml-2">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-12" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl h-12 gap-2 shadow-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {saving ? "Creando..." : "Crear Ticket"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
