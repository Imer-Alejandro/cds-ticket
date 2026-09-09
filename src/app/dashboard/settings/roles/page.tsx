"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, X, Check, Shield, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Modal } from "@/components/ui/modal"
import {
  ALL_PERMISSIONS, PERMISSION_GROUPS,
  flattenPermissions, unflattenPermissions, buildEmptyPermissions,
  type Permissions,
} from "@/lib/permissions"

interface Rol { id: string; nombre: string; permisos: Record<string, unknown>; _count?: { usuarios: number } }

const GROUP_ICONS: Record<string, string> = {
  Dashboard: "📊",
  Tickets: "🎫",
  Notificaciones: "🔔",
  Usuarios: "👥",
  "Configuración": "⚙️",
  "Configuración > Departamentos": "🏢",
  "Configuración > Categorías": "📁",
  "Configuración > Etiquetas": "🏷️",
  "Configuración > Roles": "🛡️",
  "Configuración > Equipos": "👥",
  "Configuración > Colas": "📋",
  "Configuración > SLAs": "⏱️",
  "Configuración > Correo": "📧",
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  // Permissions modal state
  const [permsRoleId, setPermsRoleId] = useState<string | null>(null)
  const [permsRoleName, setPermsRoleName] = useState("")
  const [perms, setPerms] = useState<Permissions>(buildEmptyPermissions())
  const [savingPerms, setSavingPerms] = useState(false)

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles")
      if (res.ok) setRoles(await res.json())
    } catch {
      console.error("Error fetching roles")
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRoles() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newName })
      })
      if (res.ok) { setNewName(""); fetchRoles() }
    } finally { setIsCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este rol?")) return
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    fetchRoles()
  }

  const saveEdit = async (id: string) => {
    await fetch(`/api/roles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editName })
    })
    setEditingId(null); fetchRoles()
  }

  // ── Permissions modal ────────────────────────────────────────────────────

  const openPermissions = useCallback((rol: Rol) => {
    setPermsRoleId(rol.id)
    setPermsRoleName(rol.nombre)
    const existing = rol.permisos as unknown as Permissions | undefined
    if (existing && typeof existing === "object" && "dashboard" in existing) {
      setPerms(existing)
    } else if (existing && typeof existing === "object" && "all" in existing) {
      setPerms({ ...buildEmptyPermissions(), all: true })
    } else {
      setPerms(buildEmptyPermissions())
    }
  }, [])

  const closePermissions = () => {
    setPermsRoleId(null)
    setPermsRoleName("")
  }

  const togglePerm = (key: string) => {
    setPerms((prev) => {
      const flatKeys = flattenPermissions(prev)
      const enabled = flatKeys.includes(key)
      const newKeys = enabled ? flatKeys.filter((k) => k !== key) : [...flatKeys, key]
      return unflattenPermissions(newKeys)
    })
  }

  const toggleGroup = (group: string) => {
    setPerms((prev) => {
      const flatKeys = flattenPermissions(prev)
      const groupKeys = ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => p.key)
      const allEnabled = groupKeys.every((k) => flatKeys.includes(k))
      const newKeys = allEnabled
        ? flatKeys.filter((k) => !groupKeys.includes(k))
        : [...new Set([...flatKeys, ...groupKeys])]
      return unflattenPermissions(newKeys)
    })
  }

  const savePermissions = async () => {
    if (!permsRoleId) return
    setSavingPerms(true)
    try {
      const body: Record<string, unknown> = { permisos: perms }
      if (perms.all) body.permisos = { all: true }
      const res = await fetch(`/api/roles/${permsRoleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        closePermissions()
        fetchRoles()
      } else {
        const data = await res.json()
        alert(data.error || "Error al guardar permisos")
      }
    } finally {
      setSavingPerms(false)
    }
  }

  const toggleAll = () => {
    setPerms((prev) => {
      if (prev.all) {
        return buildEmptyPermissions()
      }
      return { ...buildEmptyPermissions(), all: true } as Permissions
    })
  }

  const flatPerms = flattenPermissions(perms)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Roles</h2>
        <p className="text-muted-foreground">Gestiona los roles y permisos del sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Listado de Roles</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay roles registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((rol) => (
                    <TableRow key={rol.id}>
                      {editingId === rol.id ? (
                        <>
                          <TableCell>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>{rol._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="text-green-600" onClick={() => saveEdit(rol.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{rol.nombre}</TableCell>
                          <TableCell>{rol._count?.usuarios || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost" size="icon"
                                className="text-muted-foreground hover:text-primary"
                                title="Configurar permisos"
                                onClick={() => openPermissions(rol)}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"
                                onClick={() => { setEditingId(rol.id); setEditName(rol.nombre) }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(rol.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuevo Rol</CardTitle>
            <CardDescription>Añade un nuevo rol al sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input placeholder="Ej. Técnico" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Rol"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Permissions Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!permsRoleId}
        onClose={closePermissions}
        title={`Permisos: ${permsRoleName}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closePermissions}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={savingPerms} className="gap-2">
              {savingPerms ? "Guardando..." : "Guardar Permisos"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Acceso total (Administrador)</span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={!!perms.all}
                onChange={toggleAll}
              />
              <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {!perms.all && PERMISSION_GROUPS.map((group) => {
            const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group)
            const enabledCount = groupPerms.filter((p) => flatPerms.includes(p.key)).length
            const allEnabled = enabledCount === groupPerms.length

            return (
              <div key={group} className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{GROUP_ICONS[group] || "📋"}</span>
                    <span className="text-sm font-medium">{group}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{enabledCount}/{groupPerms.length}</span>
                    <label className="relative inline-flex cursor-pointer items-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={allEnabled}
                        onChange={() => toggleGroup(group)}
                      />
                      <div className="h-4 w-7 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </button>
                <div className="grid gap-1 p-2">
                  {groupPerms.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-muted-foreground/40 text-primary focus:ring-primary/30"
                        checked={flatPerms.includes(perm.key)}
                        onChange={() => togglePerm(perm.key)}
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
