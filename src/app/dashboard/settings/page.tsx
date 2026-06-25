"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tags, Building2, Folder, Shield, Gauge, UsersRound } from "lucide-react"

const sections = [
  { name: "Departamentos", href: "/dashboard/settings/departments", icon: Building2, desc: "Gestiona los departamentos de la empresa" },
  { name: "Categorías", href: "/dashboard/settings/categories", icon: Folder, desc: "Clasifica los tickets por categorías" },
  { name: "Etiquetas", href: "/dashboard/settings/labels", icon: Tags, desc: "Crea etiquetas personalizadas para tickets" },
  { name: "Usuarios", href: "/dashboard/users", icon: UsersRound, desc: "Administra los usuarios del sistema" },
  { name: "Roles", href: "/dashboard/settings/roles", icon: Shield, desc: "Configura roles y permisos" },
  { name: "SLAs", href: "/dashboard/settings/sla", icon: Gauge, desc: "Define reglas de nivel de servicio" },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Administra los catálogos y configuraciones del sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.name} href={section.href}>
            <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{section.name}</CardTitle>
                  <CardDescription className="mt-1">{section.desc}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
