import { describe, it, expect, vi } from 'vitest'
import { resolveRouting } from '../src/lib/auto-route'

const HARDWARE = '11111111-1111-1111-1111-111111111111'
const SOFTWARE = '22222222-2222-2222-2222-222222222222'
const EQUIPO = '33333333-3333-3333-3333-333333333333'
const SUPERVISOR = '44444444-4444-4444-4444-444444444444'
const COLA = '55555555-5555-5555-5555-555555555555'

interface FakeCategoria {
  id: string
  nombre: string
  palabrasClave: string | null
  colaDefault: { id: string; equipo: { id: string; nombre: string; supervisorId: string | null; supervisor: { id: string; nombre: string; apellido: string } | null } | null } | null
}

function makePrisma(categorias: FakeCategoria[]) {
  return {
    categoria: {
      findMany: vi.fn(async () => categorias),
      findUnique: vi.fn(async ({ where }: any) => categorias.find((c) => c.id === where.id) || null),
      findFirst: vi.fn(async () => categorias[0] || null),
    },
  } as any
}

function cat(nombre: string, palabrasClave: string | null): FakeCategoria {
  return {
    id: nombre === 'Hardware' ? HARDWARE : SOFTWARE,
    nombre,
    palabrasClave,
    colaDefault: null,
  }
}

describe('resolveRouting', () => {
  it('usa la categoría elegida manualmente por encima de las keywords', async () => {
    const prisma = makePrisma([
      cat('Hardware', 'teclado'),
      { ...cat('Software', 'instalar'), id: SOFTWARE, colaDefault: { id: COLA, equipo: { id: EQUIPO, nombre: 'Soporte', supervisorId: SUPERVISOR, supervisor: { id: SUPERVISOR, nombre: 'Ana', apellido: 'Perez' } } } },
    ])
    const r = await resolveRouting(prisma, { asunto: 'teclado roto', manualCategoriaId: SOFTWARE })
    expect(r.categoriaId).toBe(SOFTWARE)
    expect(r.categoriaNombre).toBe('Software')
    expect(r.colaId).toBe(COLA)
    expect(r.equipo).toEqual({ id: EQUIPO, nombre: 'Soporte' })
    expect(r.supervisor?.id).toBe(SUPERVISOR)
    // la coincidencia 'teclado' no elegida pasa a etiqueta automática
    expect(r.etiquetas).toContain('Hardware')
  })

  it('elige por keywords cuando no hay categoría manual y manda el asunto', async () => {
    const prisma = makePrisma([cat('Hardware', 'teclado'), cat('Software', 'instalar, programa')])
    const r = await resolveRouting(prisma, { asunto: 'no puedo instalar el programa', descripcion: 'me falló el teclado' })
    expect(r.categoriaId).toBe(SOFTWARE)
    expect(r.etiquetas).toContain('Hardware')
  })

  it('cae a la categoría por defecto sin coincidencias y con default', async () => {
    const prisma = makePrisma([cat('Hardware', 'teclado'), cat('Software', 'instalar')])
    const r = await resolveRouting(prisma, { asunto: 'renovación de contrato', defaultCategoriaId: SOFTWARE })
    expect(r.categoriaId).toBe(SOFTWARE)
    expect(r.etiquetas).toEqual([])
  })

  it('cae a la primera categoría sin coincidencias ni default', async () => {
    const prisma = makePrisma([cat('Hardware', 'teclado'), cat('Software', 'instalar')])
    const r = await resolveRouting(prisma, { asunto: 'renovación de contrato' })
    expect(r.categoriaId).toBe(HARDWARE)
  })

  it('devuelve routing vacío si no existen categorías', async () => {
    const prisma = makePrisma([])
    const r = await resolveRouting(prisma, { asunto: 'algo' })
    expect(r.categoriaId).toBe('')
    expect(r.colaId).toBeNull()
    expect(r.supervisor).toBeNull()
  })

  it('ignora categorías cuyas keywords no coinciden', async () => {
    const prisma = makePrisma([cat('Hardware', 'teclado')])
    const r = await resolveRouting(prisma, { asunto: 'perdí mi credencial' })
    expect(r.categoriaId).toBe(HARDWARE) // fallback a la primera, sin etiquetas extra
    expect(r.etiquetas).toEqual([])
  })
})