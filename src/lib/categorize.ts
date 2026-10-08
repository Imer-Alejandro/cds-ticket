export interface CategoriaKey {
  id: string
  nombre: string
  palabrasClave?: string | null
}

const COLORES_ETIQUETA = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export function etiquetaColor(nombre: string): string {
  let hash = 0
  for (const c of nombre) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return COLORES_ETIQUETA[Math.abs(hash) % COLORES_ETIQUETA.length]
}

export function splitKeywords(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function escapeRegexInput(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Clasifica un correo (asunto + cuerpo) contra las categorías definidas.
 * Una palabra clave que aparece en el asunto vale el doble que en el cuerpo
 * (el encabezado manda). Devuelve las categorías ordenadas de mayor a menor
 * coincidencia; la primera es la categoría principal candidata.
 */
export function matchCategorias(
  categorias: CategoriaKey[],
  asunto?: string | null,
  descripcion?: string | null
): CategoriaKey[] {
  const sujeto = ` ${asunto ?? ''} `
  const cuerpo = descripcion ? ` ${descripcion} ` : ''

  const scored: { categoria: CategoriaKey; coincidencias: number }[] = []
  for (const c of categorias) {
    const kws = splitKeywords(c.palabrasClave)
    if (!kws.length) continue
    let coincidencias = 0
    for (const kw of kws) {
      const re = new RegExp(`\\b${escapeRegexInput(kw)}\\b`, 'i')
      if (re.test(sujeto)) coincidencias += 2
      else if (cuerpo && re.test(cuerpo)) coincidencias += 1
    }
    if (coincidencias > 0) scored.push({ categoria: c, coincidencias })
  }

  scored.sort((a, b) => b.coincidencias - a.coincidencias)
  return scored.map((s) => s.categoria)
}