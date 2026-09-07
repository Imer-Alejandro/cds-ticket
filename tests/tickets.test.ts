import { describe, it, expect } from 'vitest'
import {
  ESTADOS_TICKET, PRIORIDADES_TICKET, ORIGENES_TICKET, ESTADOS_ACTIVOS,
  esEstadoTicket, esPrioridadTicket, esOrigenTicket, etiquetaEstado,
} from '../src/lib/tickets'

describe('dominio tickets', () => {
  it('expone estados, prioridades y orígenes válidos', () => {
    expect(ESTADOS_TICKET).toContain('NUEVO')
    expect(ESTADOS_TICKET).toContain('CERRADO')
    expect(PRIORIDADES_TICKET).toEqual(['CRITICA', 'ALTA', 'MEDIA', 'BAJA'])
    expect(ORIGENES_TICKET).toEqual(['WEB', 'CORREO'])
  })

  it('ESTADOS_ACTIVOS excluye resueltos y cerrados', () => {
    expect(ESTADOS_ACTIVOS).toEqual(['NUEVO', 'ASIGNADO', 'EN_PROGRESO'])
  })

  it('valida estados', () => {
    expect(esEstadoTicket('NUEVO')).toBe(true)
    expect(esEstadoTicket('INEXISTENTE')).toBe(false)
    expect(esEstadoTicket(undefined)).toBe(false)
  })

  it('valida prioridades', () => {
    expect(esPrioridadTicket('ALTA')).toBe(true)
    expect(esPrioridadTicket('urgente')).toBe(false)
  })

  it('valida orígenes', () => {
    expect(esOrigenTicket('CORREO')).toBe(true)
    expect(esOrigenTicket('API')).toBe(false)
  })

  it('devuelve etiqueta legible', () => {
    expect(etiquetaEstado('EN_PROGRESO')).toBe('En Progreso')
    expect(etiquetaEstado('DESCONOCIDO')).toBe('DESCONOCIDO')
  })
})