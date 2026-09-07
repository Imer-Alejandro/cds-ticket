import { describe, it, expect } from 'vitest'
import { resolveEmailCategoriaId } from '../src/lib/mail/helpers'

describe('resolveEmailCategoriaId', () => {
  it('devuelve la categoría configurada cuando es válida', async () => {
    const category = { id: '11111111-1111-1111-1111-111111111111', nombre: 'General' }
    const prismaStub = {
      categoria: {
        findUnique: async ({ where }: any) => (where.id === category.id ? category : null),
        findFirst: async () => null,
      },
    }

    const result = await resolveEmailCategoriaId(
      { defaultCategoriaId: category.id } as any,
      prismaStub as any
    )

    expect(result).toBe(category.id)
  })

  it('cae a la primera categoría cuando la configurada no existe', async () => {
    const category = { id: '22222222-2222-2222-2222-222222222222', nombre: 'Soporte' }
    const prismaStub = {
      categoria: {
        findUnique: async () => null,
        findFirst: async () => category,
      },
    }

    const result = await resolveEmailCategoriaId({ defaultCategoriaId: '' } as any, prismaStub as any)

    expect(result).toBe(category.id)
  })
})
