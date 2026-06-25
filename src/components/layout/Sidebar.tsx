"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  TicketIcon, 
  Settings, 
  Users, 
  Folders,
  Building2,
  Tags,
  Shield,
  Gauge,
  Layers,
  UsersRound,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "../ui/button"
import { useState } from "react"

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tickets", href: "/tickets", icon: TicketIcon },
  { name: "Usuarios", href: "/dashboard/users", icon: Users },
]

const settingsItems = [
  { name: "General", href: "/dashboard/settings", icon: Settings },
  { name: "Departamentos", href: "/dashboard/settings/departments", icon: Building2 },
  { name: "Categorías", href: "/dashboard/settings/categories", icon: Folders },
  { name: "Etiquetas", href: "/dashboard/settings/labels", icon: Tags },
  { name: "Roles", href: "/dashboard/settings/roles", icon: Shield },
  { name: "Equipos", href: "/dashboard/settings/teams", icon: UsersRound },
  { name: "Colas", href: "/dashboard/settings/queues", icon: Layers },
  { name: "SLAs", href: "/dashboard/settings/sla", icon: Gauge },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/dashboard/settings"))

  const handleLogout = () => {
    logout()
    window.location.href = "/login"
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card/50 px-4 py-6 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3 px-2 pb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <TicketIcon className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">Help Desk IT</span>
      </div>

      <div className="text-xs font-semibold text-muted-foreground mb-3 px-3 uppercase tracking-wider">
        Main Menu
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {mainNav.map((item) => {
          const isActive = pathname.startsWith(item.href) && 
            (item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href)
            
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.name}
            </Link>
          )
        })}

        <div className="pt-6">
          <div className="text-xs font-semibold text-muted-foreground mb-3 px-3 uppercase tracking-wider">
            Resources
          </div>
          
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5" />
              Configuración
            </div>
            {settingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {settingsOpen && (
            <div className="ml-5 mt-1 space-y-1 border-l pl-3">
              {settingsItems.map((item) => {
                const isActive = item.href === "/dashboard/settings" 
                  ? pathname === "/dashboard/settings"
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-primary bg-primary/5"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
          
          <Link
            href="/dashboard/users"
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/dashboard/users")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Users className="h-5 w-5 shrink-0" />
            User Management
          </Link>
        </div>
      </nav>

      <div className="mt-auto pt-6 pb-2 space-y-2">
        <Link href="/dashboard/profile" className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold shadow-sm border">
            {user?.nombre?.charAt(0) || "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-none">{user?.nombre || "Usuario"}</span>
            <span className="text-xs text-muted-foreground mt-1">{user?.rolNombre || "Rol"}</span>
          </div>
        </Link>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
