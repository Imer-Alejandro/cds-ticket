import { describe, it, expect } from 'vitest'
import { buildCommentEmailEvents, threadHeadersFromTicket } from '../src/lib/mail/comment-email'
import type { CommentNotifyInput } from '../src/lib/mail/comment-email'

const TICKET = {
  id: 't-1',
  codigo: 'TK-00045',
  asunto: 'Laptop no enciende',
  estado: 'EN_PROGRESO',
  nivelPrioridad: 'ALTA',
  descripcion: 'No enciende tras el apagón',
  solicitanteId: 'u-sol',
  agenteId: 'u-agt',
  messageId: 'raiz@mail',
  threadRefs: 'raiz@mail previo@mail',
  ultimoMessageId: 'previo@mail',
}

const SOLICITANTE = { id: 'u-sol', nombre: 'Juan Pérez', correo: 'juan@x.com' }
const AGENTE = { id: 'u-agt', nombre: 'Ana García', correo: 'ana@x.com' }

function makeInput(overrides: Partial<CommentNotifyInput> = {}): CommentNotifyInput {
  return {
    ticket: TICKET,
    autorId: 'u-agt',
    esInterno: false,
    solicitante: SOLICITANTE,
    agente: AGENTE,
    comentario: 'Revisando el equipo ahora mismo',
    ...overrides,
  }
}

describe('buildCommentEmailEvents', () => {
  it('comentario del agente: email al solicitante con cabeceras de hilo', () => {
    const events = buildCommentEmailEvents(makeInput())

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'NUEVO_COMENTARIO',
      to: 'juan@x.com',
      nombre: 'Juan Pérez',
      comentario: 'Revisando el equipo ahora mismo',
      inReplyTo: '<raiz@mail>',
      references: '<raiz@mail> <previo@mail>',
    })
    expect(events[0].data.codigo).toBe('TK-00045')
  })

  it('comentario del solicitante: email al agente asignado con hilo', () => {
    const events = buildCommentEmailEvents(makeInput({ autorId: 'u-sol' }))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'NUEVO_COMENTARIO',
      to: 'ana@x.com',
      nombre: 'Ana García',
      inReplyTo: '<raiz@mail>',
      references: '<raiz@mail> <previo@mail>',
    })
  })

  it('comentario interno: no genera ningún email', () => {
    expect(buildCommentEmailEvents(makeInput({ esInterno: true }))).toEqual([])
  })

  it('nunca notifica al autor del comentario', () => {
    const events = buildCommentEmailEvents(
      makeInput({ autorId: 'u-sol', solicitante: SOLICITANTE, agente: AGENTE })
    )
    expect(events).toHaveLength(1)
    expect(events[0].to).toBe('ana@x.com')
  })

  it('comentario de un tercero notifica al solicitante y al agente', () => {
    const events = buildCommentEmailEvents(makeInput({ autorId: 'u-otro' }))
    expect(events.map((e) => e.to).sort()).toEqual(['ana@x.com', 'juan@x.com'])
  })

  it('sin agente asignado solo notifica al solicitante', () => {
    const events = buildCommentEmailEvents(makeInput({ agente: null }))
    expect(events).toHaveLength(1)
    expect(events[0].to).toBe('juan@x.com')
  })

  it('omite a los destinatarios sin correo', () => {
    const events = buildCommentEmailEvents(
      makeInput({ solicitante: { ...SOLICITANTE, correo: null }, agente: AGENTE, autorId: 'u-sol' })
    )
    expect(events).toHaveLength(1)
    expect(events[0].to).toBe('ana@x.com')
  })

  it('no notifica a destinatarios inactivos (eliminados)', () => {
    const events = buildCommentEmailEvents(
      makeInput({
        autorId: 'u-otro',
        solicitante: { ...SOLICITANTE, activo: false },
        agente: { ...AGENTE, activo: false },
      })
    )
    expect(events).toEqual([])
  })

  it('notifica solo a los destinatarios activos', () => {
    const events = buildCommentEmailEvents(
      makeInput({ autorId: 'u-otro', solicitante: { ...SOLICITANTE, activo: false } })
    )
    expect(events).toHaveLength(1)
    expect(events[0].to).toBe('ana@x.com')
  })

  it('ticket sin hilo de correo: envía sin cabeceras (fallback del remitente)', () => {
    const events = buildCommentEmailEvents(
      makeInput({
        ticket: { ...TICKET, messageId: null, threadRefs: null, ultimoMessageId: null },
      })
    )
    expect(events).toHaveLength(1)
    expect(events[0].inReplyTo).toBeUndefined()
    expect(events[0].references).toBeUndefined()
  })

  it('propaga los adjuntos del comentario a los eventos', () => {
    const adjuntos = [{ nombre: 'captura.png', tipo: 'image/png', data: 'QUJD' }]
    const events = buildCommentEmailEvents(makeInput({ adjuntos }))

    expect(events).toHaveLength(1)
    expect(events[0].adjuntos).toEqual(adjuntos)
  })

  it('sin adjuntos los eventos no llevan la clave adjuntos', () => {
    const events = buildCommentEmailEvents(makeInput())
    expect(events[0].adjuntos).toBeUndefined()
  })

  it('propaga el id del ticket para guardar el hilo saliente', () => {
    const events = buildCommentEmailEvents(makeInput())
    expect(events[0].ticketId).toBe('t-1')
  })
})

describe('threadHeadersFromTicket', () => {
  it('enlaza siempre a la raíz del ticket como padre y usa la cadena completa', () => {
    const thread = threadHeadersFromTicket(TICKET)
    expect(thread.inReplyTo).toBe('<raiz@mail>')
    expect(thread.references).toBe('<raiz@mail> <previo@mail>')
  })

  it('sin raíz usa el último mensaje como padre', () => {
    const thread = threadHeadersFromTicket({ messageId: null, threadRefs: 'previo@mail', ultimoMessageId: 'previo@mail' })
    expect(thread.inReplyTo).toBe('<previo@mail>')
    expect(thread.references).toBe('<previo@mail>')
  })

  it('normaliza ids guardados con ángulos sin duplicarlos', () => {
    const thread = threadHeadersFromTicket({
      messageId: '<raiz@mail>',
      threadRefs: '<raiz@mail> <otro@mail>',
      ultimoMessageId: '<otro@mail>',
    })
    expect(thread.inReplyTo).toBe('<raiz@mail>')
    expect(thread.references).toBe('<raiz@mail> <otro@mail>')
  })

  it('sin Message-IDs no aporta cabeceras', () => {
    const thread = threadHeadersFromTicket({})
    expect(thread.inReplyTo).toBeUndefined()
    expect(thread.references).toBeUndefined()
  })
})
