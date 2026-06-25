"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Bell, Search, Plus, Loader2 } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useAuthStore } from "@/store/useAuthStore"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  codigo: string
  asunto: string
  estado: string
  nivelPrioridad: string
  solicitante: { nombre: string; apellido: string }
  agente: { nombre: string; apellido: string } | null
}

const ESTADO_LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  ASIGNADO: "Asignado",
  EN_PROGRESO: "En Progreso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function Header() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : [])
        setOpen(true)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false)
      setQuery("")
      router.push(`/tickets/${id}`)
    },
    [router],
  )

  return (
    <header className="flex h-[72px] items-center justify-between border-b bg-card/80 backdrop-blur-sm px-8 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-2xl group" ref={ref}>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar por código, asunto, agente, solicitante..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className="pl-11 h-11 bg-secondary/60 border-transparent focus-visible:bg-transparent focus-visible:ring-primary rounded-full text-sm font-medium transition-all"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}

          {open && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{r.codigo}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        r.nivelPrioridad === "CRITICA" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        r.nivelPrioridad === "ALTA" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        r.nivelPrioridad === "MEDIA" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {r.nivelPrioridad}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        r.estado === "NUEVO" ? "bg-blue-100 text-blue-700" :
                        r.estado === "EN_PROGRESO" ? "bg-amber-100 text-amber-700" :
                        r.estado === "RESUELTO" ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {ESTADO_LABEL[r.estado] || r.estado}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{r.asunto}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {r.solicitante.nombre} {r.solicitante.apellido}
                      {r.agente ? ` → ${r.agente.nombre} ${r.agente.apellido}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && query && !loading && results.length === 0 && (
            <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-2xl shadow-xl z-50 p-6 text-center">
              <p className="text-sm text-muted-foreground">Sin resultados para &quot;{query}&quot;</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <Link href="/tickets/new">
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all font-medium h-10 px-6 hidden md:flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Ticket
          </Button>
        </Link>

        <div className="h-6 w-px bg-border hidden md:block" />

        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted/80 rounded-full h-10 w-10 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </Button>

        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-bold text-foreground leading-none">{user?.nombre || "Usuario"}</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">{user?.rolNombre || "Admin"}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold border-2 border-card shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
            {user?.nombre?.charAt(0) || "U"}
          </div>
        </div>
      </div>
    </header>
  )
}
