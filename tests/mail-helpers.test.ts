import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test'

const { resolveEmailCategoriaId } = require('../src/lib/mail/helpers.ts')

test('returns configured category id when valid', async () => {
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

  assert.equal(result, category.id)
})

test('falls back to first category when configured id is missing', async () => {
  const category = { id: '22222222-2222-2222-2222-222222222222', nombre: 'Soporte' }
  const prismaStub = {
    categoria: {
      findUnique: async () => null,
      findFirst: async () => category,
    },
  }

  const result = await resolveEmailCategoriaId({ defaultCategoriaId: '' } as any, prismaStub as any)

  assert.equal(result, category.id)
})
