"use client"

import { Button } from "@/components/ui/button"
import { XCircle } from "lucide-react"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center p-8">
      <XCircle className="h-12 w-12 text-destructive" />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Ocurrió un error inesperado</h1>
        <p className="text-sm text-muted-foreground mt-1">Algo salió mal al procesar la solicitud. Intenta de nuevo.</p>
      </div>
      <Button onClick={reset} variant="outline" className="rounded-xl">Reintentar</Button>
    </div>
  )
}