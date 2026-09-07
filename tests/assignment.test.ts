import { describe, it, expect } from 'vitest'
import { pickLeastLoaded, autoAssignAgent, type AssignmentRepo, type AgenteCandidato } from '../src/lib/assignment'

describe('pickLeastLoaded', () => {
  const candidatos: AgenteCandidato[] = [
    { id: 'a', nombre: 'Ana' },
    { id: 'b', nombre: 'Bruno' },
    { id: 'c', nombre: 'Carla' },
  ]

  it('devuelve null cuando no hay candidatos', () => {
    expect(pickLeastLoaded([], [], null)).toBeNull()
  })

  it('elige al agente con menor carga', () => {
    const result = pickLeastLoaded(candidatos, [
      { agenteId: 'a', activos: 3 },
      { agenteId: 'b', activos: 1 },
      { agenteId: 'c', activos: 2 },
    ])
    expect(result?.id).toBe('b')
  })

  it('trata como 0 los agentes sin carga registrada', () => {
    const result = pickLeastLoaded(candidatos, [{ agenteId: 'b', activos: 5 }])
    expect(result?.id).toBe('a')
  })

  it('con un solo mínimo devuelve ese agente aunque haya sido el último asignado', () => {
    const result = pickLeastLoaded(candidatos, [
      { agenteId: 'a', activos: 1 },
      { agenteId: 'b', activos: 2 },
      { agenteId: 'c', activos: 2 },
    ], 'a')
    expect(result?.id).toBe('a')
  })

  it('en empate, rota excluyendo al último asignado', () => {
    const result = pickLeastLoaded(candidatos, [
      { agenteId: 'a', activos: 1 },
      { agenteId: 'b', activos: 1 },
      { agenteId: 'c', activos: 1 },
    ], 'a')
    expect(result?.id).not.toBe('a')
  })

  it('en empate sin último asignado, elige el primero', () => {
    const result = pickLeastLoaded(candidatos, [
      { agenteId: 'a', activos: 1 },
      { agenteId: 'b', activos: 1 },
      { agenteId: 'c', activos: 1 },
    ], null)
    expect(result?.id).toBe('a')
  })

  it('si todos los empatados son el último asignado, igual elige el primero', () => {
    const result = pickLeastLoaded([{ id: 'a' }], [{ agenteId: 'a', activos: 2 }], 'a')
    expect(result?.id).toBe('a')
  })
})

describe('autoAssignAgent', () => {
  const crearRepo = (overrides?: Partial<AssignmentRepo>): AssignmentRepo => ({
    getCandidatos: async () => [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Bruno' }],
    getCargas: async () => [{ agenteId: 'a', activos: 2 }, { agenteId: 'b', activos: 1 }],
    getUltimoAsignado: async () => null,
    ...overrides,
  })

  it('devuelve null sin cola', async () => {
    expect(await autoAssignAgent(crearRepo(), null)).toBeNull()
  })

  it('devuelve null si no hay candidatos en la cola', async () => {
    const repo = crearRepo({ getCandidatos: async () => [] })
    expect(await autoAssignAgent(repo, 'cola-1')).toBeNull()
  })

  it('elige al menos cargado', async () => {
    const result = await autoAssignAgent(crearRepo(), 'cola-1')
    expect(result?.id).toBe('b')
  })

  it('en empate usa round-robin con el último asignado', async () => {
    const repo = crearRepo({
      getCargas: async () => [{ agenteId: 'a', activos: 0 }, { agenteId: 'b', activos: 0 }],
      getUltimoAsignado: async () => 'a',
    })
    const result = await autoAssignAgent(repo, 'cola-1')
    expect(result?.id).toBe('b')
  })

  it('propaga errores del repo', async () => {
    const repo = crearRepo({ getCandidatos: async () => { throw new Error('boom') } })
    await expect(autoAssignAgent(repo, 'cola-1')).rejects.toThrow('boom')
  })
})