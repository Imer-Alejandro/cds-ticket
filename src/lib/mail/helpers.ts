import prisma from '@/lib/prisma'
import type { EmailConfig } from './config'

function isValidUuid(value?: string | null): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

export async function resolveEmailCategoriaId(config: EmailConfig, prismaClient = prisma): Promise<string | null> {
  const configuredId = config.defaultCategoriaId?.trim()
  if (configuredId && isValidUuid(configuredId)) {
    const categoria = await prismaClient.categoria.findUnique({ where: { id: configuredId } })
    if (categoria) return categoria.id
  }

  const fallback = await prismaClient.categoria.findFirst({ orderBy: { nombre: 'asc' } })
  return fallback?.id ?? null
}

export async function resolveEmailRoleId(prismaClient = prisma): Promise<string | null> {
  const rol = await prismaClient.rol.findFirst({ where: { nombre: 'Usuario' } })
  return rol?.id ?? null
}

export async function resolveCategoriaId(config: EmailConfig): Promise<string | null> {
  return resolveEmailCategoriaId(config)
}

export async function resolveDefaultRolId(): Promise<string | null> {
  return resolveEmailRoleId()
}
