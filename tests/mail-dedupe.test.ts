import { describe, it, expect, vi } from 'vitest'
import { handleIncomingEmail, type TicketRepo } from '../src/lib/mail/ingest'

const CAT = '11111111-1111-1111-1111-111111111111'
const ROLE = '22222222-2222-2222-2222-222222222222'

function makeRepo(overrides: Partial<TicketRepo> = {}): TicketRepo {
  const base: any = {
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ codigo: 'TK-00002' }]),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      create: vi.fn(async (args: any) => ({
        id: '00000000-0000-0000-0000-0000000000aa',
        ...args.data,
        solicitante: { nombre: 'Juan', apellido: '', correo: 'juan@x.com' },
      })),
    },
    usuario: {
      findUnique: vi.fn(),
      findFirst: vi.fn(async ({ where }: any) =>
        where.correo?.equals === 'juan@x.com'
          ? { id: '00000000-0000-0000-0000-000000000001', correo: 'juan@x.com', nombre: 'Juan' }
          : null
      ),
      create: vi.fn(async (args: any) => ({ id: 'new-user', ...args.data })),
    },
    rol: { findFirst: vi.fn(async () => ({ id: ROLE })) },
    categoria: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === CAT ? { id: CAT } : null)),
      findFirst: vi.fn(async () => ({ id: CAT })),
    },
    comentario: {
      create: vi.fn(async (args: any) => ({ id: 'c1', ...args.data })),
      findFirst: vi.fn(async () => null),
    },
    logTicket: { create: vi.fn(async (args: any) => ({ id: 'l1', ...args.data })) },
    adjunto: { createMany: vi.fn(async () => ({})) },
    sla: { findFirst: vi.fn(async () => ({ id: 'sla1' })) },
    cola: { findFirst: vi.fn() },
    correoProcesado: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: any) => ({ id: 'cp1', ...args.data })),
    },
    ...overrides,
  }
  return base as TicketRepo
}

const correo = (extra: Record<string, unknown> = {}) => ({
  from: { value: [{ address: 'juan@x.com' }] },
  subject: 'Asunto',
  text: 'cuerpo',
  ...extra,
})

describe('deduplicación por Message-ID', () => {
  it('ignora un correo cuyo Message-ID ya fue ingerido (no crea ticket ni comentario)', async () => {
    const repo = makeRepo()
    ;(repo.correoProcesado!.findUnique as any).mockResolvedValue({
      messageId: 'abc123@correo',
      ticketId: 'ticket-1',
      codigo: 'TK-00012',
      origen: 'reply',
    })

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'RE: problema [TK-00012]',
      messageId: '<abc123@correo>',
    }))

    expect(result?.kind).toBe('duplicate')
    expect(result?.ticketId).toBe('ticket-1')
    expect(result?.codigo).toBe('TK-00012')
    expect(result?.reply).toBe(true)
    expect(repo.correoProcesado!.findUnique).toHaveBeenCalledWith({ where: { messageId: 'abc123@correo' } })
    expect(repo.ticket.create).not.toHaveBeenCalled()
    expect(repo.comentario.create).not.toHaveBeenCalled()
    expect(repo.usuario.create).not.toHaveBeenCalled()
  })

  it('registra el Message-ID (normalizado, sin ángulos) al crear un ticket nuevo', async () => {
    const repo = makeRepo()

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'Laptop no enciende',
      messageId: '<nuevo-123@correo>',
    }))

    expect(result?.kind).toBe('new')
    expect(repo.correoProcesado!.create).toHaveBeenCalledWith({
      data: { messageId: 'nuevo-123@correo', ticketId: '00000000-0000-0000-0000-0000000000aa', codigo: 'TK-00003', origen: 'new' },
    })
    const createCall = (repo.ticket.create as any).mock.calls[0][0]
    expect(createCall.data).toMatchObject({
      messageId: 'nuevo-123@correo',
      ultimoMessageId: 'nuevo-123@correo',
      threadRefs: 'nuevo-123@correo',
    })
  })

  it('registra el Message-ID al responder y guarda el id en el comentario', async () => {
    const repo = makeRepo()
    ;(repo.ticket.findUnique as any).mockResolvedValue({
      id: 'ticket-1',
      codigo: 'TK-00012',
      solicitanteId: 'user-1',
      messageId: 'raiz@correo',
      threadRefs: 'raiz@correo',
      ultimoMessageId: 'raiz@correo',
    })

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'RE: problema [TK-00012]',
      messageId: '<respuesta-9@correo>',
      inReplyTo: '<raiz@correo>',
    }))

    expect(result?.kind).toBe('reply')
    expect(repo.correoProcesado!.create).toHaveBeenCalledWith({
      data: { messageId: 'respuesta-9@correo', ticketId: 'ticket-1', codigo: 'TK-00012', origen: 'reply' },
    })
    expect(repo.comentario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ messageId: 'respuesta-9@correo' }) })
    )
    expect(repo.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: { ultimoMessageId: 'respuesta-9@correo', threadRefs: expect.stringContaining('raiz@correo') },
      })
    )
  })

  it('un fallo al registrar el Message-ID no rompe el procesamiento', async () => {
    const repo = makeRepo()
    ;(repo.correoProcesado!.create as any).mockRejectedValue(new Error('P2002 unique violation'))

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      messageId: '<carrera@correo>',
    }))

    expect(result?.kind).toBe('new')
  })

  it('funciona sin repo de correoProcesado (degradación para stubs)', async () => {
    const repo = makeRepo()
    delete (repo as any).correoProcesado

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      messageId: '<sin-registro@correo>',
    }))

    expect(result?.kind).toBe('new')
  })
})

describe('anti-loop: correos del propio sistema', () => {
  it('ignora un correo enviado desde la dirección del sistema aunque traiga código TK', async () => {
    const repo = makeRepo()

    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, systemFroms: ['tickets@x.com'] },
      correo({
        from: { value: [{ address: 'Tickets@X.com' }] },
        subject: 'Respuesta [TK-00012]',
        messageId: '<salida@correo>',
      })
    )

    expect(result).toBeNull()
    expect(repo.ticket.create).not.toHaveBeenCalled()
    expect(repo.correoProcesado!.findUnique).not.toHaveBeenCalled()
    expect(repo.usuario.findFirst).not.toHaveBeenCalled()
  })

  it('procesa normalmente los correos que no vienen del sistema', async () => {
    const repo = makeRepo()

    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, systemFroms: ['otra-direccion@x.com'] },
      correo({ subject: 'Consulta', messageId: '<ok@correo>' })
    )

    expect(result?.kind).toBe('new')
  })
})

describe('respuesta por cabeceras de hilo (sin código TK en el asunto)', () => {
  it('vincula la respuesta al ticket cuyo messageId raíz aparece en In-Reply-To', async () => {
    const repo = makeRepo()
    ;(repo.ticket.findFirst as any).mockResolvedValue({
      id: 'ticket-9',
      codigo: 'TK-00042',
      solicitanteId: 'user-1',
      messageId: 'raiz-42@correo',
      threadRefs: 'raiz-42@correo',
      ultimoMessageId: 'raiz-42@correo',
    })

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'Re: mi laptop', // sin TK-
      text: 'sigue sin encender',
      inReplyTo: '<raiz-42@correo>',
      messageId: '<hijo-1@correo>',
    }))

    expect(result?.kind).toBe('reply')
    expect(result?.codigo).toBe('TK-00042')
    expect(repo.ticket.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ messageId: { in: ['raiz-42@correo'] } }, { ultimoMessageId: { in: ['raiz-42@correo'] } }] },
    })
    expect(repo.comentario.create).toHaveBeenCalled()
    expect(repo.ticket.create).not.toHaveBeenCalled()
  })

  it('vincula la respuesta por el messageId de un comentario previo del hilo', async () => {
    const repo = makeRepo()
    ;(repo.comentario.findFirst as any).mockResolvedValue({ ticketId: 'ticket-7' })
    ;(repo.ticket.findUnique as any).mockImplementation(({ where }: any) =>
      where.id === 'ticket-7'
        ? { id: 'ticket-7', codigo: 'TK-00007', solicitanteId: 'user-1', messageId: 'raiz-7@correo', threadRefs: 'raiz-7@correo', ultimoMessageId: 'raiz-7@correo' }
        : null
    )

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'Otra vez el mismo error',
      references: '<raiz-7@correo> <coment-previo@correo>',
      messageId: '<hijo-2@correo>',
    }))

    expect(result?.kind).toBe('reply')
    expect(result?.codigo).toBe('TK-00007')
    expect(repo.comentario.findFirst).toHaveBeenCalledWith({
      where: { messageId: { in: ['raiz-7@correo', 'coment-previo@correo'] } },
      select: { ticketId: true },
    })
    expect(repo.ticket.create).not.toHaveBeenCalled()
  })

  it('si las cabeceras no apuntan a ningún ticket, crea ticket nuevo', async () => {
    const repo = makeRepo()

    const result = await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({
      subject: 'Mensaje de un hilo ajeno',
      inReplyTo: '<ajeno@correo-externo>',
      messageId: '<otro@correo>',
    }))

    expect(result?.kind).toBe('new')
    expect(repo.ticket.create).toHaveBeenCalled()
  })

  it('sin cabeceras de hilo no consulta por Message-IDs', async () => {
    const repo = makeRepo()

    await handleIncomingEmail({ repo, resolveRoleId: async () => ROLE }, correo({ messageId: '<solo-esto@correo>' }))

    expect(repo.ticket.findFirst).not.toHaveBeenCalled()
    expect(repo.comentario.findFirst).not.toHaveBeenCalled()
  })
})
