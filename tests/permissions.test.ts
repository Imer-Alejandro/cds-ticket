import { describe, it, expect } from 'vitest'
import {
  resolvePermission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  flattenPermissions,
  unflattenPermissions,
  buildEmptyPermissions,
  getDefaultPermissions,
  DEFAULT_PERMISSIONS,
} from '../src/lib/permissions'

describe('resolvePermission', () => {
  const perms = getDefaultPermissions('Agente')

  it('retorna true para permisos habilitados', () => {
    expect(resolvePermission(perms, 'tickets.viewAssigned')).toBe(true)
    expect(resolvePermission(perms, 'tickets.changeStatus')).toBe(true)
    expect(resolvePermission(perms, 'tickets.create')).toBe(true)
  })

  it('retorna false para permisos deshabilitados', () => {
    expect(resolvePermission(perms, 'tickets.viewAll')).toBe(false)
    expect(resolvePermission(perms, 'tickets.delete')).toBe(false)
    expect(resolvePermission(perms, 'users.view')).toBe(false)
    expect(resolvePermission(perms, 'settings.view')).toBe(false)
  })

  it('retorna false para claves inexistentes', () => {
    expect(resolvePermission(perms, 'modulo.inexistente')).toBe(false)
    expect(resolvePermission(perms, '')).toBe(false)
  })

  it('retorna true para cualquier clave si all esta activo', () => {
    const admin = getDefaultPermissions('Administrador')
    expect(resolvePermission(admin, 'settings.roles.delete')).toBe(true)
    expect(resolvePermission(admin, 'usuarios.desconocido')).toBe(true)
  })

  it('solicitante solo ve propios y crea tickets', () => {
    const sol = getDefaultPermissions('Usuario')
    expect(resolvePermission(sol, 'tickets.viewOwn')).toBe(true)
    expect(resolvePermission(sol, 'tickets.create')).toBe(true)
    expect(resolvePermission(sol, 'tickets.viewAll')).toBe(false)
    expect(resolvePermission(sol, 'tickets.viewAssigned')).toBe(false)
    expect(resolvePermission(sol, 'tickets.edit')).toBe(false)
    expect(resolvePermission(sol, 'tickets.viewInternalComments')).toBe(false)
  })
})

describe('hasPermission / hasAnyPermission / hasAllPermissions', () => {
  const sessionAgente = { id: '1', rolNombre: 'Agente', permisos: getDefaultPermissions('Agente') }
  const sessionAdmin = { id: '2', rolNombre: 'Administrador', permisos: getDefaultPermissions('Administrador') }
  const sessionVacia = { id: '3', rolNombre: 'Usuario' }

  it('hasPermission con sesion agente', () => {
    expect(hasPermission(sessionAgente, 'tickets.viewAssigned')).toBe(true)
    expect(hasPermission(sessionAgente, 'tickets.delete')).toBe(false)
  })

  it('hasPermission respeta all: true en admin', () => {
    expect(hasPermission(sessionAdmin, 'tickets.viewAll')).toBe(true)
    expect(hasPermission(sessionAdmin, 'settings.roles.create')).toBe(true)
  })

  it('retorna false cuando no hay permisos en la sesion', () => {
    expect(hasPermission(sessionVacia, 'tickets.viewOwn')).toBe(false)
  })

  it('hasAnyPermission', () => {
    expect(hasAnyPermission(sessionAgente, ['tickets.delete', 'tickets.changeStatus'])).toBe(true)
    expect(hasAnyPermission(sessionAgente, ['tickets.delete', 'users.create'])).toBe(false)
  })

  it('hasAllPermissions', () => {
    expect(hasAllPermissions(sessionAgente, ['tickets.viewAssigned', 'tickets.create'])).toBe(true)
    expect(hasAllPermissions(sessionAgente, ['tickets.viewAssigned', 'tickets.delete'])).toBe(false)
  })
})

describe('flattenPermissions / unflattenPermissions', () => {
  it('admin plana todos los permisos', () => {
    const admin = getDefaultPermissions('Administrador')
    const keys = flattenPermissions(admin)
    expect(keys).toContain('tickets.viewAll')
    expect(keys).toContain('settings.email.edit')
    expect(keys.length).toBeGreaterThan(10)
  })

  it('round-trip: unflatten(flatten(x)) conserva los permisos', () => {
    const agente = getDefaultPermissions('Agente')
    const rebuilt = unflattenPermissions(flattenPermissions(agente))
    expect(resolvePermission(rebuilt, 'tickets.changeStatus')).toBe(true)
    expect(resolvePermission(rebuilt, 'tickets.viewAll')).toBe(false)
  })

  it('unflattenPermissions no activa permisos no listados', () => {
    const rebuilt = unflattenPermissions(['tickets.viewOwn'])
    expect(resolvePermission(rebuilt, 'tickets.viewOwn')).toBe(true)
    expect(resolvePermission(rebuilt, 'tickets.create')).toBe(false)
    expect(resolvePermission(rebuilt, 'users.view')).toBe(false)
  })

  it('buildEmptyPermissions deja todo desactivado', () => {
    const empty = buildEmptyPermissions()
    expect(resolvePermission(empty, 'dashboard.view')).toBe(false)
    expect(resolvePermission(empty, 'tickets.create')).toBe(false)
  })
})

describe('DEFAULT_PERMISSIONS', () => {
  it('define los 4 roles base', () => {
    expect(Object.keys(DEFAULT_PERMISSIONS)).toEqual(['Administrador', 'Supervisor', 'Agente', 'Usuario'])
  })

  it('el admin tiene all true y el resto no', () => {
    expect(DEFAULT_PERMISSIONS.Administrador.all).toBe(true)
    expect(DEFAULT_PERMISSIONS.Supervisor.all).toBeUndefined()
    expect(DEFAULT_PERMISSIONS.Agente.all).toBeUndefined()
    expect(DEFAULT_PERMISSIONS.Usuario.all).toBeUndefined()
  })

  it('supervisor ve todos los tickets y puede asignar pero no eliminar', () => {
    const sup = DEFAULT_PERMISSIONS.Supervisor
    expect(sup.tickets.viewAll).toBe(true)
    expect(sup.tickets.assign).toBe(true)
    expect(sup.tickets.delete).toBe(false)
    expect(sup.users.view).toBe(true)
    expect(sup.users.delete).toBe(false)
  })
})