import { JWTPayload } from 'jose'

// ── Permission definition types ──────────────────────────────────────────────

export interface ModulePermissions {
  view: boolean
  create?: boolean
  edit?: boolean
  delete?: boolean
}

export interface TicketsPermissions {
  viewAll: boolean
  viewAssigned: boolean
  viewOwn: boolean
  create: boolean
  edit: boolean
  assign: boolean
  changeStatus: boolean
  delete: boolean
  viewInternalComments: boolean
}

export interface SettingsPermissions {
  view: boolean
  departments: ModulePermissions
  categories: ModulePermissions
  labels: ModulePermissions
  roles: ModulePermissions
  teams: ModulePermissions
  queues: ModulePermissions
  sla: ModulePermissions
  email: { view: boolean; edit: boolean }
}

export interface Permissions {
  all?: boolean
  dashboard: { view: boolean }
  tickets: TicketsPermissions
  notifications: { view: boolean }
  users: ModulePermissions
  settings: SettingsPermissions
}

// ── All available permissions (for the matrix UI) ────────────────────────────

export interface PermissionDef {
  key: string
  label: string
  group: string
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'Ver Dashboard', group: 'Dashboard' },

  // Tickets
  { key: 'tickets.viewAll', label: 'Ver todos los tickets', group: 'Tickets' },
  { key: 'tickets.viewAssigned', label: 'Ver tickets asignados', group: 'Tickets' },
  { key: 'tickets.viewOwn', label: 'Ver tickets propios', group: 'Tickets' },
  { key: 'tickets.create', label: 'Crear tickets', group: 'Tickets' },
  { key: 'tickets.edit', label: 'Editar tickets', group: 'Tickets' },
  { key: 'tickets.assign', label: 'Asignar tickets', group: 'Tickets' },
  { key: 'tickets.changeStatus', label: 'Cambiar estado', group: 'Tickets' },
  { key: 'tickets.delete', label: 'Eliminar tickets', group: 'Tickets' },
  { key: 'tickets.viewInternalComments', label: 'Ver comentarios internos', group: 'Tickets' },

  // Notifications
  { key: 'notifications.view', label: 'Ver notificaciones', group: 'Notificaciones' },

  // Users
  { key: 'users.view', label: 'Ver usuarios', group: 'Usuarios' },
  { key: 'users.create', label: 'Crear usuarios', group: 'Usuarios' },
  { key: 'users.edit', label: 'Editar usuarios', group: 'Usuarios' },
  { key: 'users.delete', label: 'Eliminar usuarios', group: 'Usuarios' },

  // Settings
  { key: 'settings.view', label: 'Ver configuración', group: 'Configuración' },
  { key: 'settings.departments.view', label: 'Ver departamentos', group: 'Configuración > Departamentos' },
  { key: 'settings.departments.create', label: 'Crear departamentos', group: 'Configuración > Departamentos' },
  { key: 'settings.departments.edit', label: 'Editar departamentos', group: 'Configuración > Departamentos' },
  { key: 'settings.departments.delete', label: 'Eliminar departamentos', group: 'Configuración > Departamentos' },
  { key: 'settings.categories.view', label: 'Ver categorías', group: 'Configuración > Categorías' },
  { key: 'settings.categories.create', label: 'Crear categorías', group: 'Configuración > Categorías' },
  { key: 'settings.categories.edit', label: 'Editar categorías', group: 'Configuración > Categorías' },
  { key: 'settings.categories.delete', label: 'Eliminar categorías', group: 'Configuración > Categorías' },
  { key: 'settings.labels.view', label: 'Ver etiquetas', group: 'Configuración > Etiquetas' },
  { key: 'settings.labels.create', label: 'Crear etiquetas', group: 'Configuración > Etiquetas' },
  { key: 'settings.labels.edit', label: 'Editar etiquetas', group: 'Configuración > Etiquetas' },
  { key: 'settings.labels.delete', label: 'Eliminar etiquetas', group: 'Configuración > Etiquetas' },
  { key: 'settings.roles.view', label: 'Ver roles', group: 'Configuración > Roles' },
  { key: 'settings.roles.create', label: 'Crear roles', group: 'Configuración > Roles' },
  { key: 'settings.roles.edit', label: 'Editar roles', group: 'Configuración > Roles' },
  { key: 'settings.roles.delete', label: 'Eliminar roles', group: 'Configuración > Roles' },
  { key: 'settings.teams.view', label: 'Ver equipos', group: 'Configuración > Equipos' },
  { key: 'settings.teams.create', label: 'Crear equipos', group: 'Configuración > Equipos' },
  { key: 'settings.teams.edit', label: 'Editar equipos', group: 'Configuración > Equipos' },
  { key: 'settings.teams.delete', label: 'Eliminar equipos', group: 'Configuración > Equipos' },
  { key: 'settings.queues.view', label: 'Ver colas', group: 'Configuración > Colas' },
  { key: 'settings.queues.create', label: 'Crear colas', group: 'Configuración > Colas' },
  { key: 'settings.queues.edit', label: 'Editar colas', group: 'Configuración > Colas' },
  { key: 'settings.queues.delete', label: 'Eliminar colas', group: 'Configuración > Colas' },
  { key: 'settings.sla.view', label: 'Ver SLAs', group: 'Configuración > SLAs' },
  { key: 'settings.sla.create', label: 'Crear SLAs', group: 'Configuración > SLAs' },
  { key: 'settings.sla.edit', label: 'Editar SLAs', group: 'Configuración > SLAs' },
  { key: 'settings.sla.delete', label: 'Eliminar SLAs', group: 'Configuración > SLAs' },
  { key: 'settings.email.view', label: 'Ver correo', group: 'Configuración > Correo' },
  { key: 'settings.email.edit', label: 'Configurar correo', group: 'Configuración > Correo' },
]

// ── Permission groups for UI rendering ───────────────────────────────────────

export const PERMISSION_GROUPS = [
  'Dashboard',
  'Tickets',
  'Notificaciones',
  'Usuarios',
  'Configuración',
  'Configuración > Departamentos',
  'Configuración > Categorías',
  'Configuración > Etiquetas',
  'Configuración > Roles',
  'Configuración > Equipos',
  'Configuración > Colas',
  'Configuración > SLAs',
  'Configuración > Correo',
]

// ── Default permissions per role ─────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  Administrador: {
    all: true,
    dashboard: { view: true },
    tickets: {
      viewAll: true, viewAssigned: true, viewOwn: true,
      create: true, edit: true, assign: true, changeStatus: true,
      delete: true, viewInternalComments: true,
    },
    notifications: { view: true },
    users: { view: true, create: true, edit: true, delete: true },
    settings: {
      view: true,
      departments: { view: true, create: true, edit: true, delete: true },
      categories: { view: true, create: true, edit: true, delete: true },
      labels: { view: true, create: true, edit: true, delete: true },
      roles: { view: true, create: true, edit: true, delete: true },
      teams: { view: true, create: true, edit: true, delete: true },
      queues: { view: true, create: true, edit: true, delete: true },
      sla: { view: true, create: true, edit: true, delete: true },
      email: { view: true, edit: true },
    },
  },
  Supervisor: {
    dashboard: { view: true },
    tickets: {
      viewAll: true, viewAssigned: true, viewOwn: true,
      create: true, edit: true, assign: true, changeStatus: true,
      delete: false, viewInternalComments: true,
    },
    notifications: { view: true },
    users: { view: true, create: false, edit: false, delete: false },
    settings: {
      view: true,
      departments: { view: true, create: true, edit: true, delete: false },
      categories: { view: true, create: false, edit: false, delete: false },
      labels: { view: true, create: false, edit: false, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      teams: { view: true, create: true, edit: true, delete: false },
      queues: { view: true, create: false, edit: false, delete: false },
      sla: { view: true, create: false, edit: false, delete: false },
      email: { view: true, edit: false },
    },
  },
  Agente: {
    dashboard: { view: false },
    tickets: {
      viewAll: false, viewAssigned: true, viewOwn: true,
      create: true, edit: true, assign: false, changeStatus: true,
      delete: false, viewInternalComments: true,
    },
    notifications: { view: true },
    users: { view: false, create: false, edit: false, delete: false },
    settings: {
      view: false,
      departments: { view: false, create: false, edit: false, delete: false },
      categories: { view: false, create: false, edit: false, delete: false },
      labels: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      teams: { view: false, create: false, edit: false, delete: false },
      queues: { view: false, create: false, edit: false, delete: false },
      sla: { view: false, create: false, edit: false, delete: false },
      email: { view: false, edit: false },
    },
  },
  Usuario: {
    dashboard: { view: false },
    tickets: {
      viewAll: false, viewAssigned: false, viewOwn: true,
      create: true, edit: false, assign: false, changeStatus: false,
      delete: false, viewInternalComments: false,
    },
    notifications: { view: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: {
      view: false,
      departments: { view: false, create: false, edit: false, delete: false },
      categories: { view: false, create: false, edit: false, delete: false },
      labels: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      teams: { view: false, create: false, edit: false, delete: false },
      queues: { view: false, create: false, edit: false, delete: false },
      sla: { view: false, create: false, edit: false, delete: false },
      email: { view: false, edit: false },
    },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getDefaultPermissions(roleName: string): Permissions {
  return DEFAULT_PERMISSIONS[roleName] || DEFAULT_PERMISSIONS.Usuario
}

export function buildEmptyPermissions(): Permissions {
  return {
    dashboard: { view: false },
    tickets: {
      viewAll: false, viewAssigned: false, viewOwn: false,
      create: false, edit: false, assign: false, changeStatus: false,
      delete: false, viewInternalComments: false,
    },
    notifications: { view: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: {
      view: false,
      departments: { view: false, create: false, edit: false, delete: false },
      categories: { view: false, create: false, edit: false, delete: false },
      labels: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      teams: { view: false, create: false, edit: false, delete: false },
      queues: { view: false, create: false, edit: false, delete: false },
      sla: { view: false, create: false, edit: false, delete: false },
      email: { view: false, edit: false },
    },
  }
}

/**
 * Resolve a dot-separated permission key (e.g. "settings.departments.create")
 * against a permissions object. Returns true if allowed, false otherwise.
 */
export function resolvePermission(permissions: Permissions, key: string): boolean {
  if (permissions.all) return true

  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = permissions

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return false
    current = current[part]
  }

  return current === true
}

/**
 * Check if a session has a specific permission.
 * session is the decoded JWT payload (JWTPayload & Record<string, unknown>).
 */
export function hasPermission(
  session: JWTPayload | Record<string, unknown>,
  key: string
): boolean {
  const permisos = session.permisos as Permissions | undefined
  if (!permisos) return false
  return resolvePermission(permisos, key)
}

/**
 * Check if a session has ANY of the given permissions.
 */
export function hasAnyPermission(
  session: JWTPayload | Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.some((key) => hasPermission(session, key))
}

/**
 * Check if a session has ALL of the given permissions.
 */
export function hasAllPermissions(
  session: JWTPayload | Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.every((key) => hasPermission(session, key))
}

/**
 * Get the flat list of enabled permission keys from a Permissions object.
 */
export function flattenPermissions(permissions: Permissions): string[] {
  if (permissions.all) return ALL_PERMISSIONS.map((p) => p.key)
  return ALL_PERMISSIONS.filter((p) => resolvePermission(permissions, p.key)).map(
    (p) => p.key
  )
}

/**
 * Convert a flat array of permission keys into a Permissions object.
 */
export function unflattenPermissions(keys: string[]): Permissions {
  const perms = buildEmptyPermissions()
  for (const key of keys) {
    setPermission(perms, key, true)
  }
  return perms
}

function setPermission(permissions: Permissions, key: string, value: boolean) {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = permissions
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) current[parts[i]] = {}
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}
