import prisma from '@/lib/prisma'
import type { EmailConfig } from './config'

export async function resolveCategoriaId(config: EmailConfig): Promise<string | null> {
  if (config.defaultCategoriaId) {
    const categoria = await prisma.categoria.findUnique({ where: { id: config.defaultCategoriaId } })
    if (categoria) return categoria.id
  }
  const fallback = await prisma.categoria.findFirst({ orderBy: { nombre: 'asc' } })
  return fallback?.id ?? null
}

export async function resolveDefaultRolId(): Promise<string | null> {
  const rol = await prisma.rol.findFirst({ where: { nombre: 'Usuario' } })
  return rol?.id ?? null
}
