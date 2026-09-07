import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center p-8">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground mt-1">La página o recurso que buscas no existe o fue movido.</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="rounded-xl"><Link href="/tickets">Ir a Tickets</Link></Button>
        <Button asChild className="rounded-xl"><Link href="/dashboard">Ir al Dashboard</Link></Button>
      </div>
    </div>
  )
}