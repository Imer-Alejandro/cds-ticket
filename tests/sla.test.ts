import { describe, it, expect } from 'vitest'
import { slaStatus, formatSlaMinutes, slaProgress } from '../src/lib/sla'

describe('slaStatus', () => {
  const base = {
    createdAt: '2024-01-01T10:00:00Z',
    minutesResponse: 60,
    minutesResolution: 240,
    now: new Date('2024-01-01T10:30:00Z'),
  }

  it('marca ok si está dentro del límite', () => {
    const s = slaStatus(base)
    expect(s.responseStatus).toBe('ok')
    expect(s.resolutionStatus).toBe('ok')
    expect(s.elapsedMinutes).toBe(30)
  })

  it('marca warning en el 75% de la respuesta', () => {
    const s = slaStatus({ ...base, now: new Date('2024-01-01T10:50:00Z') })
    expect(s.responseStatus).toBe('warning')
  })

  it('marca breach tras superar el límite de respuesta', () => {
    const s = slaStatus({ ...base, now: new Date('2024-01-01T11:05:00Z') })
    expect(s.responseStatus).toBe('breached')
  })

  it('computa respuesta ok si la primera respuesta llegó a tiempo', () => {
    const s = slaStatus({
      ...base,
      now: new Date('2024-01-01T11:30:00Z'),
      firstResponseAt: '2024-01-01T10:20:00Z',
    })
    expect(s.responseStatus).toBe('ok')
  })

  it('computa breach de resolución si se resolvió después del límite', () => {
    const s = slaStatus({
      ...base,
      resolvedAt: '2024-01-01T15:00:00Z',
    })
    expect(s.resolutionStatus).toBe('breached')
  })

  it('no descuenta minutos en caso de reloj atrasado', () => {
    const s = slaStatus({ ...base, now: new Date('2023-01-01T00:00:00Z') })
    expect(s.elapsedMinutes).toBe(0)
  })
})

describe('formatSlaMinutes', () => {
  it('formatea horas y minutos', () => {
    expect(formatSlaMinutes(90)).toBe('1h 30m')
  })
  it('formatea días', () => {
    expect(formatSlaMinutes(1500)).toBe('1d 1h')
  })
  it('formatea solo minutos', () => {
    expect(formatSlaMinutes(45)).toBe('45m')
  })
  it('trata valores negativos', () => {
    expect(formatSlaMinutes(-5)).toBe('0m')
  })
})

describe('slaProgress', () => {
  it('calcula proporción', () => {
    expect(slaProgress(30, 60)).toBe(0.5)
  })
  it('satura en 1', () => {
    expect(slaProgress(90, 60)).toBe(1)
  })
  it('devuelve 0 con límite inválido', () => {
    expect(slaProgress(10, 0)).toBe(0)
  })
})