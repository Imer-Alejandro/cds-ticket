import { describe, it, expect } from 'vitest'
import { ackTicketEmail, assignmentEmail, statusEmail, commentEmail, slaAvisoEmail } from '../src/lib/mail/templates'

const data = {
  codigo: 'TK-00012',
  asunto: 'Impresora no funciona <script>alert(1)</script>',
  estado: 'ASIGNADO',
  prioridad: 'ALTA',
  descripcion: 'Se atascó el papel',
}

describe('email templates', () => {
  it('ackTicketEmail genera asunto y html', () => {
    const { subject, html } = ackTicketEmail('Juan', data)
    expect(subject).toBe('Ticket TK-00012: Impresora no funciona <script>alert(1)</script>')
    expect(html).toContain('Ticket registrado')
    expect(html).toContain('TK-00012')
    expect(html).toContain('Hola <strong>Juan</strong>')
  })

  it('escapa HTML en los campos del ticket', () => {
    const { html } = ackTicketEmail('Juan', data)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('assignmentEmail incluye nombre del agente', () => {
    const { subject, html } = assignmentEmail({ ...data, agenteNombre: 'Ana' })
    expect(subject).toContain('Ticket asignado a ti')
    expect(html).toContain('Hola <strong>Ana</strong>')
  })

  it('statusEmail incluye el estado legible', () => {
    const { html } = statusEmail('Juan', { ...data, estadoLabel: 'En Progreso' })
    expect(html).toContain('cambiado de estado a <strong>En Progreso</strong>')
  })

  it('commentEmail incluye el comentario', () => {
    const { html } = commentEmail('Juan', data, 'Ya lo estoy revisando')
    expect(html).toContain('Ya lo estoy revisando')
  })

  it('slaAvisoEmail incluye la alerta, el detalle y el enlace al ticket', () => {
    const { subject, html } = slaAvisoEmail('Ana', {
      ...data,
      alerta: 'Plazo de respuesta vencido',
      detalle: 'El ticket superó el plazo máximo de respuesta.',
      url: 'http://localhost:3000/tickets/abc',
    })
    expect(subject).toBe('[TK-00012] Alerta de SLA: Plazo de respuesta vencido')
    expect(html).toContain('Hola <strong>Ana</strong>')
    expect(html).toContain('El ticket superó el plazo máximo de respuesta.')
    expect(html).toContain('http://localhost:3000/tickets/abc')
  })

  it('slaAvisoEmail escapa contenido de usuario', () => {
    const { html } = slaAvisoEmail('Ana', {
      ...data,
      alerta: '<b>x</b>',
      detalle: '<script>alert(1)</script>',
      url: 'javascript:alert(1)',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('javascript:alert(1)')
  })
})
