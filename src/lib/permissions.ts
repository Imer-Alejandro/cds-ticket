import type { JWTPayload } from 'jose'

// ── Fuente única de verdad ───────────────────────────────────────────────────
// El árbol de permisos se declara UNA sola vez. De él se derivan el tipo
// `Permissions`, `ALL_PERMISSIONS`, `PERMISSION_GROUPS`, `buildEmptyPermissions()`
// y los defaults por rol, eliminando la duplicación manual entre estructuras.

export interface PermissionMeta {
  label: string
  group: string
}

export interface PermissionDef {
  key: string
  label: string
  group: string
}

function perm(label: string, group: string): PermissionMeta {
  return { label, group }
}

function modulePerms(group: string, nombre: string) {
  return {
    view: perm(`Ver ${nombre}`, group),
    create: perm(`Crear ${nombre}`, group),
    edit: perm(`Editar ${nombre}`, group),
    delete: perm(`Eliminar ${nombre}`, group),
  }
}

const PERMISSIONS_TREE = {
  dashboard: {
    view: perm('Ver Dashboard', 'Dashboard'),
  },
  tickets: {
    viewAll: perm('Ver todos los tickets', 'Tickets'),
    viewAssigned: perm('Ver tickets asignados', 'Tickets'),
    viewOwn: perm('Ver tickets propios', 'Tickets'),
    create: perm('Crear tickets', 'Tickets'),
    edit: perm('Editar tickets', 'Tickets'),
    assign: perm('Asignar tickets', 'Tickets'),
    changeStatus: perm('Cambiar estado', 'Tickets'),
    delete: perm('Eliminar tickets', 'Tickets'),
    viewInternalComments: perm('Ver comentarios internos', 'Tickets'),
  },
  users: modulePerms('Usuarios', 'usuarios'),
  templates: modulePerms('Plantillas', 'plantillas'),
  reports: {
    view: perm('Ver reportes', 'Reportes'),
    export: perm('Exportar reportes', 'Reportes'),
  },
  automations: modulePerms('Automatizaciones', 'automatizaciones'),
  surveys: {
    view: perm('Ver encuestas', 'Encuestas'),
  },
  settings: {
    departments: modulePerms('Configuración > Departamentos', 'departamentos'),
    categories: modulePerms('Configuración > Categorías', 'categorías'),
    labels: modulePerms('Configuración > Etiquetas', 'etiquetas'),
    roles: modulePerms('Configuración > Roles', 'roles'),
    teams: modulePerms('Configuración > Equipos', 'equipos'),
    queues: modulePerms('Configuración > Colas', 'colas'),
    sla: modulePerms('Configuración > SLAs', 'SLAs'),
    email: {
      view: perm('Ver correo', 'Configuración > Correo'),
      edit: perm('Configurar correo', 'Configuración > Correo'),
    },
  },
} as const

type PermsOf<T> = {
  [K in keyof T]: T[K] extends { label: string; group: string } ? boolean : PermsOf<T[K]>
}

export type Permissions = { all?: boolean } & PermsOf<typeof PERMISSIONS_TREE>

function isLeaf(value: unknown): value is PermissionMeta {
  return typeof value === 'object' && value !== null && 'label' in value && 'group' in value
}

function flattenMeta(tree: Record<string, unknown>, prefix = ''): PermissionDef[] {
  const out: PermissionDef[] = []
  for (const [key, value] of Object.entries(tree)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (isLeaf(value)) {
      out.push({ key: fullKey, label: value.label, group: value.group })
    } else {
      out.push(...flattenMeta(value as Record<string, unknown>, fullKey))
    }
  }
  return out
}

function emptyTree(tree: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tree)) {
    out[key] = isLeaf(value) ? false : emptyTree(value as Record<string, unknown>)
  }
  return out
}

// ── Derivan del árbol único ──────────────────────────────────────────────────

export const ALL_PERMISSIONS: PermissionDef[] = flattenMeta(
  PERMISSIONS_TREE as unknown as Record<string, unknown>
)

export const PERMISSION_GROUPS: string[] = [...new Set(ALL_PERMISSIONS.map((p) => p.group))]

export const ALL_PERMISSION_KEYS: Set<string> = new Set(ALL_PERMISSIONS.map((p) => p.key))

// ── Defaults por rol (perfiles base, validados contra el árbol) ──────────────

/** Cualquiera de estos permisos habilita listar usuarios (gestión o equipos). */
export const USERS_LIST_PERMISSIONS: string[] = [
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'settings.teams.view',
  'settings.teams.create',
  'settings.teams.edit',
  'settings.teams.delete',
]

const DEFAULT_PERMISSION_KEYS: Record<string, string[]> = {
  Administrador: ['__all__'],
  Supervisor: [
    'dashboard.view',
    'tickets.viewAll',
    'tickets.viewAssigned',
    'tickets.viewOwn',
    'tickets.create',
    'tickets.edit',
    'tickets.assign',
    'tickets.changeStatus',
    'tickets.viewInternalComments',
    'users.view',
    'templates.view',
    'templates.create',
    'templates.edit',
    'reports.view',
    'reports.export',
    'automations.view',
    'surveys.view',
    'settings.departments.view',
    'settings.departments.create',
    'settings.departments.edit',
    'settings.categories.view',
    'settings.labels.view',
    'settings.roles.view',
    'settings.teams.view',
    'settings.teams.create',
    'settings.teams.edit',
    'settings.queues.view',
    'settings.sla.view',
    'settings.email.view',
  ],
  Agente: [
    'tickets.viewAssigned',
    'tickets.viewOwn',
    'tickets.create',
    'tickets.edit',
    'tickets.changeStatus',
    'tickets.viewInternalComments',
    'templates.view',
    'templates.create',
  ],
  Usuario: ['tickets.viewOwn', 'tickets.create'],
}

export const DEFAULT_PERMISSIONS: Record<string, Permissions> = Object.fromEntries(
  Object.entries(DEFAULT_PERMISSION_KEYS).map(([nombre, keys]) => [
    nombre,
    keys.includes('__all__')
      ? ({ all: true } as Permissions)
      : unflattenPermissions(keys),
  ])
)

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getDefaultPermissions(roleName: string): Permissions {
  return DEFAULT_PERMISSIONS[roleName] || DEFAULT_PERMISSIONS.Usuario
}

export function buildEmptyPermissions(): Permissions {
  return emptyTree(PERMISSIONS_TREE as unknown as Record<string, unknown>) as Permissions
}

/**
 * Filtra un objeto de permisos recibido del cliente dejando únicamente claves
 * conocidas (o `all: true`). Previene guardar permisos arbitrarios en BD.
 */
export function sanitizePermissions(input: unknown): Permissions {
  if (
    input &&
    typeof input === 'object' &&
    (input as Record<string, unknown>).all === true
  ) {
    return { all: true } as Permissions
  }
  const keys: string[] = []
  const collect = (current: unknown, prefix = '') => {
    if (!current || typeof current !== 'object') return
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value === true && ALL_PERMISSION_KEYS.has(path)) keys.push(path)
      else if (value && typeof value === 'object') collect(value, path)
    }
  }
  collect(input)
  return unflattenPermissions([...new Set(keys)])
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