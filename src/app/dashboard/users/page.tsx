"use client"

import { useState, useEffect } from "react"
import { fetchJson, apiFetch } from "@/lib/api"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { usePermissions } from "@/hooks/usePermissions"
import { Modal } from "@/components/ui/modal"

interface Rol { id: string; nombre: string }
interface Departamento { id: string; nombre: string }
interface Usuario {
  id: string; nombre: string; apellido: string; correo: string
  userName: string; telefono: string | null
  rol: Rol; departamento: Departamento | null
  fechaRegistro: string
}

const EMPTY_FORM = {
  nombre: "", apellido: "", correo: "", userName: "", password: "",
  telefono: "", rolId: "", departamentoId: ""
}

export default function UsersPage() {
  const { hasPermission } = usePermissions()
  const [users, setUsers] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [departments, setDepartments] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    Promise.all([
      fetchJson<Usuario[]>("/api/users", []),
      fetchJson<Rol[]>("/api/roles", []),
      fetchJson<Departamento[]>("/api/departments", []),
    ]).then(([usersData, rolesData, departmentsData]) => {
      setUsers(usersData)
      setRoles(rolesData)
      setDepartments(departmentsData)
    }).finally(() => setLoading(false))
  }, [])

  const reloadUsers = async () => {
    setUsers(await fetchJson<Usuario[]>("/api/users", []))
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        closeForm()
        await reloadUsers()
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

  const handleEdit = (user: Usuario) => {
    setEditingId(user.id)
    setForm({
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      userName: user.userName,
      password: "",
      telefono: user.telefono || "",
      rolId: user.rol.id,
      departamentoId: user.departamento?.id || "",
    })
    setShowForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        closeForm()
        await reloadUsers()
      } else {
        const err = await res.json()
        alert(err.error)
      }
    } catch (error) {
      console.error("Error updating user", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar este usuario? No podrá iniciar sesión ni aparecerá en el listado.")) return
    try {
      await apiFetch(`/api/users/${id}`, { method: "DELETE" })
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
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

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
                      {hasPermission("users.edit") && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => handleEdit(user)} title="Editar usuario">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission("users.delete") && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(user.id)} title="Eliminar usuario">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal open={showForm} onClose={closeForm} title={editingId ? "Editar Usuario" : "Nuevo Usuario"} size="lg"
        footer={<>
          <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
          <Button type="submit" form="user-form" disabled={saving}>{saving ? "Guardando..." : (editingId ? "Guardar Cambios" : "Crear Usuario")}</Button>
        </>}
      >
        <form id="user-form" onSubmit={editingId ? handleUpdate : handleCreate} className="grid gap-4 md:grid-cols-2">
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
            <label className="text-sm font-medium">{editingId ? "Contraseña" : "Contraseña *"}</label>
            <Input type="password" required={!editingId} placeholder={editingId ? "Dejar vacío para no cambiar" : undefined} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
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
        </form>
      </Modal>
    </div>
  )
}
