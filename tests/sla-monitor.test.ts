import { describe, it, expect } from 'vitest'
import { computeSlaEvents, SLA_EVENT_ORDER, type SlaTicketLite } from '../src/lib/sla-monitor'

const base = (over: Partial<SlaTicketLite> = {}): SlaTicketLite => ({
  id: 't1',
  codigo: 'TK-0001',
  creadoEl: '2026-01-01T00:00:00Z',
  sla: { minutosRespuesta: 60, minutosResolucion: 240 },
  ...over,
})

describe('computeSlaEvents', () => {
  it('no emite eventos antes del 75% del plazo de respuesta', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T00:44:00Z'))).toEqual([])
  })

  it('emite AVISO_RESPUESTA al alcanzar el 75% del plazo sin primera respuesta', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T00:45:00Z'))).toEqual(['AVISO_RESPUESTA'])
  })

  it('emite VENCIDO_RESPUESTA al superar el plazo de respuesta', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T01:01:00Z'))).toEqual(['VENCIDO_RESPUESTA'])
  })

  it('emite AVISO_RESPUESTA solo una vez (dedupe por ya avisados)', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z' })
    expect(computeSlaEvents(t, ['AVISO_RESPUESTA'], new Date('2026-01-01T00:50:00Z'))).toEqual([])
    expect(computeSlaEvents(t, ['AVISO_RESPUESTA'], new Date('2026-01-01T01:30:00Z'))).toEqual(['VENCIDO_RESPUESTA'])
  })

  it('no emite VENCIDO_RESPUESTA si ya hubo una primera respuesta', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z', primeraRespuesta: '2026-01-01T00:15:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T02:00:00Z'))).not.toContain('VENCIDO_RESPUESTA')
    expect(computeSlaEvents(t, [], new Date('2026-01-01T02:00:00Z'))).not.toContain('AVISO_RESPUESTA')
  })

  it('emite VENCIDO_RESOLUCION al superar el plazo de resolución sin resolver', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T04:01:00Z'))).toEqual(['VENCIDO_RESPUESTA', 'VENCIDO_RESOLUCION'])
  })

  it('no emite VENCIDO_RESOLUCION si el ticket ya está resuelto', () => {
    const t = base({ creadoEl: '2026-01-01T00:00:00Z', resueltoEl: '2026-01-01T02:00:00Z' })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T10:00:00Z'))).not.toContain('VENCIDO_RESOLUCION')
  })

  it('no emite eventos si el ticket no tiene SLA', () => {
    const t = base({ sla: null })
    expect(computeSlaEvents(t, [], new Date('2026-01-01T05:00:00Z'))).toEqual([])
  })

  it('mantiene un orden estable de eventos', () => {
    expect(SLA_EVENT_ORDER).toEqual(['AVISO_RESPUESTA', 'VENCIDO_RESPUESTA', 'VENCIDO_RESOLUCION'])
  })
})