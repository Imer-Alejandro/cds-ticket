"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  TicketIcon, 
  Settings, 
  Users, 
  Folders, 
  LogOut 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "../ui/button"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tickets", href: "/dashboard/tickets", icon: TicketIcon },
  { name: "Usuarios", href: "/dashboard/users", icon: Users },
  { name: "Categorías", href: "/dashboard/categories", icon: Folders },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    window.location.href = "/login"
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card px-4 py-6 shadow-sm">
      <div className="flex items-center gap-2 px-2 pb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          HD
        </div>
        <span className="text-xl font-bold tracking-tight">Help Desk IT</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href) && 
            (item.href === "/dashboard" ? pathname === "/dashboard" : true)
            
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 pb-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold">
            {user?.nombre?.charAt(0) || "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-none">{user?.nombre || "Usuario"}</span>
            <span className="text-xs text-muted-foreground mt-1">{user?.rolNombre || "Rol"}</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 mt-4 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
