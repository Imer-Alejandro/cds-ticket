"use client"

import { Bell, Search } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 shadow-sm">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar tickets..." 
            className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-transparent"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-destructive"></span>
        </Button>
      </div>
    </header>
  )
}
