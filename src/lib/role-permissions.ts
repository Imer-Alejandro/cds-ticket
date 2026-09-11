import prisma from '@/lib/prisma'
import { Permissions } from '@/lib/permissions'

const TTL_MS = 60_000

const cache = new Map<string, { permisos: Permissions; expiresAt: number }>()

/**
 * Devuelve los permisos frescos (BD) de un rol, cacheados durante 60s.
 * Permite propagar cambios de permisos sin que el usuario deba re-login.
 */
export async function freshRolePermissions(rolId: string): Promise<Permissions | null> {
  const hit = cache.get(rolId)
  if (hit && hit.expiresAt > Date.now()) return hit.permisos

  const rol = await prisma.rol.findUnique({
    where: { id: rolId },
    select: { permisos: true },
  })

  const permisos = (rol?.permisos ?? {}) as Permissions
  cache.set(rolId, { permisos, expiresAt: Date.now() + TTL_MS })
  return rol ? permisos : null
}

/** Invalida la cache al editar/eliminar un rol. */
export function invalidateRolePermissions(rolId: string): void {
  cache.delete(rolId)
}