import { describe, it, expect } from 'vitest'
import { splitKeywords, etiquetaColor, matchCategorias, type CategoriaKey } from '../src/lib/categorize'

const cat = (id: string, nombre: string, palabrasClave: string | null): CategoriaKey => ({ id, nombre, palabrasClave })

describe('splitKeywords', () => {
  it('convierte una lista separada por comas y normaliza espacios', () => {
    expect(splitKeywords('  teclado , monitor , impresora ')).toEqual(['teclado', 'monitor', 'impresora'])
  })

  it('filtra vacíos y devuelve [] si no hay keywords', () => {
    expect(splitKeywords('')).toEqual([])
    expect(splitKeywords(null)).toEqual([])
    expect(splitKeywords('  ,  , ')).toEqual([])
  })
})

describe('etiquetaColor', () => {
  it('devuelve un color determinístico para el mismo nombre', () => {
    expect(etiquetaColor('Hardware')).toBe(etiquetaColor('Hardware'))
  })

  it('devuelve un color distinto para nombres distintos', () => {
    expect(etiquetaColor('Hardware')).not.toBe(etiquetaColor('Software'))
  })
})

describe('matchCategorias', () => {
  const cats = [
    cat('h', 'Hardware', 'teclado, monitor, impresora'),
    cat('s', 'Software', 'programa, instalar, actualizar'),
    cat('n', 'Redes', 'wifi, switch'),
  ]

  it('prioriza la coincidencia en el asunto (peso 2) sobre el cuerpo (peso 1)', () => {
    // 'instalar' en asunto gana ante 'teclado' en cuerpo (2 > 1)
    const [top, segunda] = matchCategorias(cats, 'instalar actualización', 'se me rompió el teclado')
    expect(top.id).toBe('s')
    expect(segunda.id).toBe('h')
  })

  it('devuelve las categorías ordenadas por coincidencias, de mayor a menor', () => {
    const orden = matchCategorias(cats, 'wifi instalado', 'monitor nuevo').map((c) => c.id)
    // wifi (2 en asunto) >= ... 'instalar' (2) empata, y 'monitor' (1) queda atrás
    expect(orden).toContain('n')
    expect(orden[orden.length - 1]).toBe('h')
  })

  it('respeta límites de palabra completa en el asunto', () => {
    const [top] = matchCategorias(cats, 'instalador', null)
    expect(top).toBeUndefined()
  })

  it('es case-insensitive', () => {
    const [top] = matchCategorias(cats, 'CAMBIAR MONITOR', null)
    expect(top.id).toBe('h')
  })

  it('ignora categorías sin palabras clave', () => {
    const [top] = matchCategorias([cat('x', 'Otra', null)], 'teclado', null)
    expect(top).toBeUndefined()
  })
})