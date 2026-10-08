import type { PrismaClient } from '@prisma/client'
import { matchCategorias, splitKeywords, type CategoriaKey } from './categorize'

export interface RoutingResult {
  categoriaId: string
  categoriaNombre: string
  colaId: string | null
  equipo: { id: string; nombre: string } | null
  supervisor: { id: string; nombre: string; apellido: string } | null
  etiquetas: string[]
}

export interface RoutingFilter {
  asunto?: string
  descripcion?: string
  manualCategoriaId?: string | null
  defaultCategoriaId?: string | null
}

/**
 * Resuelve el "routing" de un ticket nuevo a partir de las palabras clave de
 * las categorías (asunto + cuerpo) y de la asociación Categoría → Cola → Equipo:
 *
 *  - Categoría principal: manual (si viene definida) > mejor coincidencia de
 *    keywords > categoría por defecto de la bandeja > primera categoría.
 *  - Las demás coincidencias se devuelven como etiquetas automáticas.
 *  - Equipo y supervisor se toman de la cola por defecto de la categoría.
 */
export async function resolveRouting(
  prisma: PrismaClient,
  filter: RoutingFilter
): Promise<RoutingResult> {
  const conPalabras = (await prisma.categoria.findMany({
    where: { palabrasClave: { not: null } },
    select: { id: true, nombre: true, palabrasClave: true },
  })) as CategoriaKey[]

  const candidatas = conPalabras.filter((c) => splitKeywords(c.palabrasClave).length > 0)
  const coincidencias = matchCategorias(candidatas, filter.asunto, filter.descripcion)

  const manual = filter.manualCategoriaId?.trim()
  const elegidaPorKeyword = coincidencias[0]?.id ?? null
  const deseadaId = manual || elegidaPorKeyword || filter.defaultCategoriaId?.trim() || null

  let categoria = deseadaId
    ? await prisma.categoria.findUnique({
        where: { id: deseadaId },
        include: {
          colaDefault: {
            include: {
              equipo: { select: { id: true, nombre: true, supervisorId: true, supervisor: { select: { id: true, nombre: true, apellido: true } } } },
            },
          },
        },
      })
    : null

  if (!categoria) {
    categoria = await prisma.categoria.findFirst({
      orderBy: { nombre: 'asc' },
      include: {
        colaDefault: {
          include: {
            equipo: { select: { id: true, nombre: true, supervisorId: true, supervisor: { select: { id: true, nombre: true, apellido: true } } } },
          },
        },
      },
    })
  }
  if (!categoria) return { categoriaId: '', categoriaNombre: '', colaId: null, equipo: null, supervisor: null, etiquetas: [] }

  const colaDefault = categoria.colaDefault
  const equipo = colaDefault?.equipo ?? null
  const supervisor = (equipo?.supervisor as RoutingResult['supervisor']) ?? null

  return {
    categoriaId: categoria.id,
    categoriaNombre: categoria.nombre,
    colaId: colaDefault?.id ?? null,
    equipo: equipo ? { id: equipo.id, nombre: equipo.nombre } : null,
    supervisor,
    etiquetas: coincidencias.filter((c) => c.id !== categoria.id).map((c) => c.nombre),
  }
}