"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"

interface Rol { id: string; nombre: string }
interface Departamento { id: string; nombre: string }
interface Usuario {
  id: string; nombre: string; apellido: string; correo: string
  userName: string; telefono: string | null
  rol: Rol; departamento: Departamento | null
  fechaRegistro: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [departments, setDepartments] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nombre: "", apellido: "", correo: "", userName: "", password: "",
    telefono: "", rolId: "", departamentoId: ""
  })

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then(r => r.ok && r.json()).then(setUsers),
      fetch("/api/roles").then(r => r.ok && r.json()).then(setRoles),
      fetch("/api/departments").then(r => r.ok && r.json()).then(setDepartments),
    ]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ nombre: "", apellido: "", correo: "", userName: "", password: "", telefono: "", rolId: "", departamentoId: "" })
        const data = await fetch("/api/users").then(r => r.json())
        setUsers(data)
      } else {
        const err = await res.json()
        alert(err.error)
      }
    } catch (error) {
      console.error("Error creating user", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" })
      setUsers(users.filter(u => u.id !== id))
    } catch (error) {
      console.error("Error deleting user", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Usuarios</h2>
          <p className="text-muted-foreground">Gestiona los usuarios del sistema.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? "Cancelar" : "Nuevo Usuario"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Usuario</CardTitle>
            <CardDescription>Registra un nuevo usuario en el sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre *</label>
                <Input required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apellido *</label>
                <Input required value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo *</label>
                <Input type="email" required value={form.correo} onChange={e => setForm({...form, correo: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuario (username) *</label>
                <Input required value={form.userName} onChange={e => setForm({...form, userName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña *</label>
                <Input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol *</label>
                <select
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.rolId}
                  onChange={e => setForm({...form, rolId: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.departamentoId}
                  onChange={e => setForm({...form, departamentoId: e.target.value})}
                >
                  <option value="">Sin departamento</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear Usuario"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Listado de Usuarios</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nombre} {user.apellido}</TableCell>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>{user.correo}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {user.rol.nombre}
                      </span>
                    </TableCell>
                    <TableCell>{user.departamento?.nombre || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(user.id)}>
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
    </div>
  )
}
