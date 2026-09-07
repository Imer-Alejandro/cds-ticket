import type { PrismaClient } from '@prisma/client'
import type { AssignmentRepo } from './assignment'
import { ESTADOS_ACTIVOS } from './tickets'

/**
 * Factory que recibe el cliente Prisma (Next o backend) para no depender
 * del alias `@/` ni de un cliente concreto en el servidor de correo.
 */
export function makePrismaAssignmentRepo(prisma: PrismaClient): AssignmentRepo {
  return {
    async getCandidatos(colaId: string) {
      const miembros = await prisma.equipoUsuario.findMany({
        where: { equipo: { colas: { some: { id: colaId } } } },
        select: { usuario: { select: { id: true, nombre: true, apellido: true } } },
      })
      return miembros.map((m) => ({ id: m.usuario.id, nombre: `${m.usuario.nombre} ${m.usuario.apellido}`.trim() }))
    },

    async getCargas(agenteIds: string[]) {
      if (!agenteIds.length) return []
      const grupos = await prisma.ticket.groupBy({
        by: ['agenteId'],
        where: { agenteId: { in: agenteIds }, estado: { in: ESTADOS_ACTIVOS as string[] } },
        _count: { _all: true },
      })
      return grupos.map((g) => ({ agenteId: g.agenteId as string, activos: g._count._all }))
    },

    async getUltimoAsignado(colaId: string) {
      const t = await prisma.ticket.findFirst({
        where: { colaId, agenteId: { not: null } },
        orderBy: { fechaCreacion: 'desc' },
        select: { agenteId: true },
      })
      return t?.agenteId ?? null
    },
  }
}