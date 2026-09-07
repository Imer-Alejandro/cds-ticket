import { describe, it, expect } from 'vitest'
import { buildEmailMessage, toTicketEmailData, type EmailEvent } from '../src/lib/mail/notify-email'

const data = toTicketEmailData({
  codigo: 'TK-00045',
  asunto: 'Laptop no enciende',
  estado: 'ASIGNADO',
  nivelPrioridad: 'ALTA',
  descripcion: 'La laptop no enciende después de un apagón',
})

describe('buildEmailMessage', () => {
  it('construye ack de ticket creado', () => {
    const ev: EmailEvent = { type: 'TICKET_CREADO', to: 'juan@x.com', nombre: 'Juan', data }
    const msg = buildEmailMessage(ev)
    expect(msg.to).toBe('juan@x.com')
    expect(msg.subject).toContain('TK-00045')
    expect(msg.html).toContain('Ticket registrado')
    expect(msg.html).toContain('Juan')
  })

  it('construye notificación de asignación al agente', () => {
    const ev: EmailEvent = { type: 'TICKET_ASIGNADO', to: 'ana@x.com', agenteNombre: 'Ana', data }
    const msg = buildEmailMessage(ev)
    expect(msg.to).toBe('ana@x.com')
    expect(msg.subject).toContain('asignado a ti')
    expect(msg.html).toContain('Hola <strong>Ana</strong>')
  })

  it('construye notificación de cambio de estado', () => {
    const ev: EmailEvent = { type: 'ESTADO_CAMBIADO', to: 'juan@x.com', nombre: 'Juan', data, estadoLabel: 'En Progreso' }
    const msg = buildEmailMessage(ev)
    expect(msg.html).toContain('En Progreso')
  })

  it('construye notificación de nuevo comentario', () => {
    const ev: EmailEvent = { type: 'NUEVO_COMENTARIO', to: 'juan@x.com', nombre: 'Juan', data, comentario: 'Revisando ahora' }
    const msg = buildEmailMessage(ev)
    expect(msg.html).toContain('Revisando ahora')
    expect(msg.subject).toContain('comentario en')
  })
})

describe('toTicketEmailData', () => {
  it('mapea correctamente un ticket', () => {
    const result = toTicketEmailData({
      codigo: 'TK-00001',
      asunto: 'Test',
      estado: 'NUEVO',
      nivelPrioridad: 'MEDIA',
      descripcion: null,
    })
    expect(result).toEqual({
      codigo: 'TK-00001',
      asunto: 'Test',
      estado: 'NUEVO',
      prioridad: 'MEDIA',
      descripcion: '',
    })
  })
})
