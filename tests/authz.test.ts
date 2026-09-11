import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDefaultPermissions, buildEmptyPermissions, resolvePermission } from '../src/lib/permissions'

// ── Mocks compartidos ────────────────────────────────────────────────────────

const prismaMocks = vi.hoisted(() => {
  const fns = new Map<string, ReturnType<typeof vi.fn>>()
  const methodHandler = (model: string): ProxyHandler<Record<string, unknown>> => ({
    get(_t, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined
      const key = `${model}.${prop}`
      if (!fns.has(key)) fns.set(key, vi.fn())
      return fns.get(key)
    },
  })
  const models: Record<string, unknown> = new Proxy(
    {},
    {
      get(t: Record<string, unknown>, prop: string) {
        if (typeof prop !== 'string') return undefined
        if (!(prop in t)) t[prop] = new Proxy({}, methodHandler(prop))
        return t[prop]
      },
      set() {
        return true
      },
    }
  )
  return { models, fns }
})

vi.mock('@/lib/prisma', () => ({ default: prismaMocks.models }))

const authMocks = vi.hoisted(() => ({ getSession: vi.fn(), getSessionFromRequest: vi.fn() }))
vi.mock('@/lib/auth', () => authMocks)

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
  emitTicketUpdate: vi.fn(),
  notifyAgentes: vi.fn(),
}))
vi.mock('@/lib/mail/notify-email', () => ({
  notifyByEmail: vi.fn(),
  toTicketEmailData: vi.fn(() => ({})),
}))
vi.mock('@/lib/mail/core', () => ({
  nextTicketCode: vi.fn(() => 'T-0001'),
}))
vi.mock('@/lib/assignment', () => ({
  autoAssignAgent: vi.fn(async () => null),
  pickLeastLoaded: vi.fn(),
}))
vi.mock('@/lib/assignment-prisma', () => ({
  makePrismaAssignmentRepo: vi.fn(() => ({})),
}))

// ── Route handlers bajo test ─────────────────────────────────────────────────

import { GET as rolesGET, POST as rolesPOST } from '../src/app/api/roles/route'
import {
  PUT as rolesIdPUT,
  DELETE as rolesIdDELETE,
} from '../src/app/api/roles/[id]/route'
import { GET as templatesGET, POST as templatesPOST } from '../src/app/api/templates/route'
import {
  PUT as templatesIdPUT,
  DELETE as templatesIdDELETE,
} from '../src/app/api/templates/[id]/route'
import { GET as usersGET } from '../src/app/api/users/route'
import { GET as usersIdGET } from '../src/app/api/users/[id]/route'
import { GET as agentsGET } from '../src/app/api/users/agents/route'
import { GET as searchGET } from '../src/app/api/search/route'
import { PATCH as ticketsPATCH } from '../src/app/api/tickets/[id]/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

type Session = {
  id: string
  rolId: string
  rolNombre: string
  permisos?: Record<string, unknown>
}

const sessionAdmin: Session = { id: 'u-admin', rolId: 'r1', rolNombre: 'Administrador', permisos: getDefaultPermissions('Administrador') as Record<string, unknown> }
const sessionSupervisor: Session = { id: 'u-sup', rolId: 'r2', rolNombre: 'Supervisor', permisos: getDefaultPermissions('Supervisor') as Record<string, unknown> }
const sessionAgente: Session = { id: 'u-age', rolId: 'r3', rolNombre: 'Agente', permisos: getDefaultPermissions('Agente') as Record<string, unknown> }
const sessionUsuario: Session = { id: 'u-use', rolId: 'r4', rolNombre: 'Usuario', permisos: getDefaultPermissions('Usuario') as Record<string, unknown> }
const sessionSinPermisos: Session = { id: 'u-none', rolId: 'rX', rolNombre: 'SinPermisos', permisos: buildEmptyPermissions() as Record<string, unknown> }

function setSession(s: Session | null) {
  authMocks.getSession.mockResolvedValue(s)
}

function prisma(model: string, method: string) {
  return (prismaMocks.models[model] as Record<string, ReturnType<typeof vi.fn>>)[method]
}

function req(method: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new Request('http://localhost', init)
}

function getReq(url = 'http://localhost/api/search?q=algo') {
  return new Request(url, { method: 'GET' })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Roles: GET ───────────────────────────────────────────────────────────────

describe('GET /api/roles', () => {
  it('401 sin sesión', async () => {
    setSession(null)
    expect((await rolesGET()).status).toBe(401)
  })

  it('403 para rol sin settings.roles.view', async () => {
    setSession(sessionUsuario)
    expect((await rolesGET()).status).toBe(403)
    setSession(sessionAgente)
    expect((await rolesGET()).status).toBe(403)
  })

  it('200 para supervisor y admin', async () => {
    prisma('rol', 'findMany').mockResolvedValue([])
    setSession(sessionSupervisor)
    expect((await rolesGET()).status).toBe(200)
    setSession(sessionAdmin)
    const res = await rolesGET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

// ── Roles: POST (sanitización de permisos) ───────────────────────────────────

describe('POST /api/roles', () => {
  it('403 si no tiene settings.roles.create', async () => {
    setSession(sessionUsuario)
    const res = await rolesPOST(req('POST', { nombre: 'X' }))
    expect(res.status).toBe(403)
  })

  it('sanitiza permisos arbitrarios', async () => {
    prisma('rol', 'create').mockResolvedValue({ id: 'r9', nombre: 'X' })
    setSession(sessionAdmin)
    const res = await rolesPOST(
      req('POST', { nombre: 'X', permisos: { 'modulo.inventado': true, 'tickets.create': true } })
    )
    expect(res.status).toBe(201)
    const arg = prisma('rol', 'create').mock.calls[0][0]
    expect(resolvePermission(arg.data.permisos, 'tickets.create')).toBe(true)
    expect('modulo' in arg.data.permisos).toBe(false)
  })

  it('permisos vacíos por defecto', async () => {
    prisma('rol', 'create').mockResolvedValue({ id: 'r9', nombre: 'X' })
    setSession(sessionAdmin)
    await rolesPOST(req('POST', { nombre: 'X' }))
    const arg = prisma('rol', 'create').mock.calls[0][0]
    expect(resolvePermission(arg.data.permisos, 'tickets.viewAll')).toBe(false)
  })
})

// ── Roles: [id] PUT/DELETE/GET ───────────────────────────────────────────────

describe('PUT /api/roles/[id]', () => {
  it('403 sin settings.roles.edit', async () => {
    setSession(sessionUsuario)
    const res = await rolesIdPUT(req('PUT', { nombre: 'X' }), params('r1'))
    expect(res.status).toBe(403)
  })

  it('renombrar sin permisos no borra los existentes', async () => {
    prisma('rol', 'update').mockResolvedValue({ id: 'r1', nombre: 'Nuevo' })
    setSession(sessionAdmin)
    const res = await rolesIdPUT(req('PUT', { nombre: 'Nuevo' }), params('r1'))
    expect(res.status).toBe(200)
    const arg = prisma('rol', 'update').mock.calls[0][0]
    expect('permisos' in arg.data).toBe(false)
    expect(arg.data.nombre).toBe('Nuevo')
  })

  it('sanitiza permisos al actualizarlos', async () => {
    prisma('rol', 'update').mockResolvedValue({ id: 'r1', nombre: 'X' })
    setSession(sessionAdmin)
    const res = await rolesIdPUT(
      req('PUT', { nombre: 'X', permisos: { 'templates.view': true, 'modulo.inventado': true } }),
      params('r1')
    )
    expect(res.status).toBe(200)
    const arg = prisma('rol', 'update').mock.calls[0][0]
    expect(resolvePermission(arg.data.permisos, 'templates.view')).toBe(true)
    expect('modulo' in arg.data.permisos).toBe(false)
  })
})

describe('DELETE /api/roles/[id]', () => {
  it('403 sin settings.roles.delete', async () => {
    setSession(sessionSupervisor)
    const res = await rolesIdDELETE(req('DELETE'), params('r1'))
    expect(res.status).toBe(403)
  })

  it('409 si el rol tiene usuarios', async () => {
    prisma('usuario', 'count').mockResolvedValue(3)
    setSession(sessionAdmin)
    const res = await rolesIdDELETE(req('DELETE'), params('r1'))
    expect(res.status).toBe(409)
  })

  it('200 si no tiene usuarios', async () => {
    prisma('usuario', 'count').mockResolvedValue(0)
    prisma('rol', 'delete').mockResolvedValue({})
    setSession(sessionAdmin)
    const res = await rolesIdDELETE(req('DELETE'), params('r1'))
    expect(res.status).toBe(200)
  })
})

// ── Templates ────────────────────────────────────────────────────────────────

describe('GET /api/templates', () => {
  it('403 para Usuario (sin templates.view)', async () => {
    prisma('plantillaRespuesta', 'findMany').mockResolvedValue([])
    setSession(sessionUsuario)
    const res = await templatesGET(req('GET'))
    expect(res.status).toBe(403)
  })

  it('200 para agente', async () => {
    prisma('plantillaRespuesta', 'findMany').mockResolvedValue([])
    setSession(sessionAgente)
    expect((await templatesGET(req('GET'))).status).toBe(200)
  })
})

describe('POST /api/templates', () => {
  it('403 sin templates.create', async () => {
    setSession(sessionUsuario)
    const res = await templatesPOST(req('POST', { titulo: 'T', contenido: 'C' }))
    expect(res.status).toBe(403)
  })

  it('201 con templates.create', async () => {
    prisma('plantillaRespuesta', 'create').mockResolvedValue({ id: 'p1' })
    setSession(sessionSupervisor)
    const res = await templatesPOST(req('POST', { titulo: 'T', contenido: 'C' }))
    expect(res.status).toBe(201)
  })
})

describe('PUT/DELETE /api/templates/[id]', () => {
  it('403 en PUT sin templates.edit', async () => {
    setSession(sessionAgente)
    const res = await templatesIdPUT(req('PUT', { titulo: 'T' }), params('p1'))
    expect(res.status).toBe(403)
  })

  it('200 en PUT para admin', async () => {
    prisma('plantillaRespuesta', 'update').mockResolvedValue({ id: 'p1' })
    setSession(sessionAdmin)
    const res = await templatesIdPUT(req('PUT', { titulo: 'T' }), params('p1'))
    expect(res.status).toBe(200)
  })

  it('403 en DELETE sin templates.delete', async () => {
    setSession(sessionSupervisor)
    const res = await templatesIdDELETE(req('DELETE'), params('p1'))
    expect(res.status).toBe(403)
  })

  it('200 en DELETE para admin', async () => {
    prisma('plantillaRespuesta', 'delete').mockResolvedValue({})
    setSession(sessionAdmin)
    const res = await templatesIdDELETE(req('DELETE'), params('p1'))
    expect(res.status).toBe(200)
  })
})

// ── Users ────────────────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('403 para Usuario y Agente', async () => {
    prisma('usuario', 'findMany').mockResolvedValue([])
    setSession(sessionUsuario)
    expect((await usersGET()).status).toBe(403)
    setSession(sessionAgente)
    expect((await usersGET()).status).toBe(403)
  })

  it('200 para supervisor y admin', async () => {
    prisma('usuario', 'findMany').mockResolvedValue([])
    setSession(sessionSupervisor)
    expect((await usersGET()).status).toBe(200)
    setSession(sessionAdmin)
    expect((await usersGET()).status).toBe(200)
  })
})

describe('GET /api/users/[id]', () => {
  it('403 sin permisos de listado', async () => {
    prisma('usuario', 'findUnique').mockResolvedValue({ id: 'u1' })
    setSession(sessionUsuario)
    expect((await usersIdGET(req('GET'), params('u1'))).status).toBe(403)
  })

  it('200 para supervisor', async () => {
    prisma('usuario', 'findUnique').mockResolvedValue({ id: 'u1', nombre: 'A' })
    setSession(sessionSupervisor)
    const res = await usersIdGET(req('GET'), params('u1'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/users/agents', () => {
  it('403 sin tickets.assign', async () => {
    setSession(sessionAgente)
    const res = await agentsGET()
    expect(res.status).toBe(403)
  })

  it('solo devuelve usuarios con permisos de agente', async () => {
    prisma('usuario', 'findMany').mockResolvedValue([
      {
        id: 'a1',
        nombre: 'Ana',
        apellido: 'Perez',
        rol: { nombre: 'Agente', permisos: getDefaultPermissions('Agente') },
      },
      {
        id: 'u1',
        nombre: 'User',
        apellido: 'X',
        rol: { nombre: 'Usuario', permisos: getDefaultPermissions('Usuario') },
      },
    ])
    setSession(sessionSupervisor)
    const res = await agentsGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('a1')
  })
})

// ── Search: scope por permisos ───────────────────────────────────────────────

describe('GET /api/search', () => {
  it('403 sin ningún permiso de vista de tickets', async () => {
    prisma('ticket', 'findMany').mockResolvedValue([])
    setSession(sessionSinPermisos)
    const res = await searchGET(getReq())
    expect(res.status).toBe(403)
  })

  it('usuario solo busca tickets propios', async () => {
    prisma('ticket', 'findMany').mockResolvedValue([])
    setSession(sessionUsuario)
    const res = await searchGET(getReq())
    expect(res.status).toBe(200)
    const arg = prisma('ticket', 'findMany').mock.calls[0][0]
    expect(arg.where.AND).toEqual([{ solicitanteId: 'u-use' }])
    expect(arg.where.OR).toBeDefined()
  })

  it('admin no recibe filtro de scope', async () => {
    prisma('ticket', 'findMany').mockResolvedValue([])
    setSession(sessionAdmin)
    await searchGET(getReq())
    const arg = prisma('ticket', 'findMany').mock.calls[0][0]
    expect(arg.where.OR).toBeDefined()
    expect(arg.where.AND).toBeUndefined()
  })
})

// ── Tickets: PATCH estado ────────────────────────────────────────────────────

describe('PATCH /api/tickets/[id] (cambio de estado)', () => {
  const ticket = {
    id: 't1',
    codigo: 'T-0001',
    asunto: 'Problema',
    descripcion: 'Detalle',
    estado: 'NUEVO',
    nivelPrioridad: 'MEDIA',
    solicitanteId: 'u-use',
    agenteId: 'u-age',
  }

  it('403 sin tickets.changeStatus', async () => {
    prisma('ticket', 'findUnique').mockResolvedValue(ticket)
    setSession(sessionSinPermisos)
    const res = await ticketsPATCH(req('PATCH', { estado: 'RESUELTO' }), params('t1'))
    expect(res.status).toBe(403)
    expect(prisma('ticket', 'update')).not.toHaveBeenCalled()
  })

  it('403 solicitante sin permiso de cambio de estado', async () => {
    prisma('ticket', 'findUnique').mockResolvedValue(ticket)
    setSession(sessionUsuario)
    const res = await ticketsPATCH(req('PATCH', { estado: 'CERRADO' }), params('t1'))
    expect(res.status).toBe(403)
  })

  it('200 para agente con tickets.changeStatus', async () => {
    prisma('ticket', 'findUnique').mockResolvedValue(ticket)
    prisma('ticket', 'update').mockResolvedValue({ ...ticket, estado: 'RESUELTO' })
    prisma('usuario', 'findUnique').mockResolvedValue(null)
    prisma('logTicket', 'create').mockResolvedValue({})
    setSession(sessionAgente)
    const res = await ticketsPATCH(req('PATCH', { estado: 'RESUELTO' }), params('t1'))
    expect(res.status).toBe(200)
    const arg = prisma('ticket', 'update').mock.calls[0][0]
    expect(arg.data.estado).toBe('RESUELTO')
    expect(arg.data.fechaResolucion).toBeDefined()
  })
})