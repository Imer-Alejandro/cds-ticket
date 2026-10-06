import { describe, it, expect, vi } from 'vitest'
import {
  notifyIngestResult,
  type NotifyIngestDeps,
  type TicketNotificacion,
} from '../src/lib/mail/notify-ingest'

function makeTicket(overrides: Partial<TicketNotificacion> = {}): TicketNotificacion {
  return {
    id: 'ticket-1',
    codigo: 'TK-00045',
    asunto: 'Laptop no enciende',
    estado: 'EN_PROGRESO',
    nivelPrioridad: 'ALTA',
    descripcion: 'No enciende',
    solicitante: { id: 'u-sol', nombre: 'Juan', apellido: 'Pérez', correo: 'juan@x.com' },
    agente: { id: 'u-agt', nombre: 'Ana', apellido: 'García', correo: 'ana@x.com' },
    messageId: 'raiz@mail',
    threadRefs: 'raiz@mail previo@mail',
    ultimoMessageId: 'previo@mail',
    ...overrides,
  }
}

function makeDeps(overrides: Partial<NotifyIngestDeps> = {}): NotifyIngestDeps {
  return {
    findTicket: vi.fn(async () => makeTicket()),
    findAgentes: vi.fn(async () => [
      { id: 'u-agt', nombre: 'Ana' },
      { id: 'u-otro', nombre: 'Luis' },
    ]),
    findAdministradores: vi.fn(async () => [
      { id: 'u-adm', nombre: 'Admin', correo: 'admin@x.com' },
    ]),
    notify: vi.fn(async () => {}),
    sendEmail: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  }
}

describe('notifyIngestResult', () => {
  it('ignora resultados duplicate y sin ticketId (no toca nada)', async () => {
    const deps = makeDeps()

    await notifyIngestResult({ kind: 'duplicate', ticketId: 't1', codigo: 'TK-00001' }, deps)
    await notifyIngestResult({ kind: 'reply', ticketId: '', codigo: 'TK-00002' }, deps)

    expect(deps.findTicket).not.toHaveBeenCalled()
    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.sendEmail).not.toHaveBeenCalled()
    expect(deps.emit).not.toHaveBeenCalled()
  })

  it('ticket nuevo: notifica a todos los agentes y envía acuse al solicitante', async () => {
    const deps = makeDeps()

    await notifyIngestResult({ kind: 'new', ticketId: 'ticket-1', codigo: 'TK-00045' }, deps)

    expect(deps.notify).toHaveBeenCalledTimes(2)
    expect(deps.notify).toHaveBeenCalledWith('u-agt', 'NUEVO_TICKET', expect.stringContaining('TK-00045'), 'ticket-1')
    expect(deps.notify).toHaveBeenCalledWith('u-otro', 'NUEVO_TICKET', expect.any(String), 'ticket-1')

    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TICKET_CREADO',
        to: 'juan@x.com',
        inReplyTo: '<previo@mail>',
        references: '<raiz@mail> <previo@mail>',
      })
    )
    expect(deps.emit).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'TK-00045' }), 'nuevo')
  })

  it('respuesta por correo: notifica al agente asignado Y a todos los administradores', async () => {
    const deps = makeDeps()

    await notifyIngestResult({ kind: 'reply', ticketId: 'ticket-1', codigo: 'TK-00045', reply: true }, deps)

    expect(deps.notify).toHaveBeenCalledTimes(2)
    expect(deps.notify).toHaveBeenCalledWith('u-agt', 'NUEVO_COMENTARIO', expect.stringContaining('por correo'), 'ticket-1')
    expect(deps.notify).toHaveBeenCalledWith('u-adm', 'NUEVO_COMENTARIO', expect.stringContaining('por correo'), 'ticket-1')

    const correos = (deps.sendEmail as any).mock.calls.map((c: any[]) => c[0].to).sort()
    expect(correos).toEqual(['admin@x.com', 'ana@x.com'])
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NUEVO_COMENTARIO',
        inReplyTo: '<previo@mail>',
        references: '<raiz@mail> <previo@mail>',
      })
    )
    expect(deps.emit).toHaveBeenCalledWith(expect.any(Object), 'comentario')
  })

  it('respuesta sin agente asignado: solo administradores', async () => {
    const deps = makeDeps({ findTicket: vi.fn(async () => makeTicket({ agente: null })) })

    await notifyIngestResult({ kind: 'reply', ticketId: 'ticket-1', codigo: 'TK-00045' }, deps)

    expect(deps.notify).toHaveBeenCalledTimes(1)
    expect(deps.notify).toHaveBeenCalledWith('u-adm', 'NUEVO_COMENTARIO', expect.any(String), 'ticket-1')
    expect((deps.sendEmail as any).mock.calls[0][0].to).toBe('admin@x.com')
  })

  it('no duplica cuando el agente asignado también es administrador', async () => {
    const deps = makeDeps({
      findTicket: vi.fn(async () => makeTicket({ agente: { id: 'u-adm', nombre: 'Admin', correo: 'admin@x.com' } })),
    })

    await notifyIngestResult({ kind: 'reply', ticketId: 'ticket-1', codigo: 'TK-00045' }, deps)

    expect(deps.notify).toHaveBeenCalledTimes(1)
    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('administrador sin correo: recibe notificación in-app pero no email', async () => {
    const deps = makeDeps({
      findAdministradores: vi.fn(async () => [{ id: 'u-adm', nombre: 'Admin', correo: null }]),
      findTicket: vi.fn(async () => makeTicket({ agente: null })),
    })

    await notifyIngestResult({ kind: 'reply', ticketId: 'ticket-1', codigo: 'TK-00045' }, deps)

    expect(deps.notify).toHaveBeenCalledTimes(1)
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('si el ticket ya no existe, no notifica', async () => {
    const deps = makeDeps({ findTicket: vi.fn(async () => null) })

    await notifyIngestResult({ kind: 'reply', ticketId: 'borrado', codigo: 'TK-00045' }, deps)

    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.sendEmail).not.toHaveBeenCalled()
    expect(deps.emit).not.toHaveBeenCalled()
  })
})
