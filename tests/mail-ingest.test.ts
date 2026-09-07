import { describe, it, expect, vi } from 'vitest'
import { decideIncomingEmail, handleIncomingEmail, adjuntosValidos, type TicketRepo } from '../src/lib/mail/ingest'

const CAT = '11111111-1111-1111-1111-111111111111'
const ROLE = '22222222-2222-2222-2222-222222222222'

function makeRepo(overrides: Partial<TicketRepo> = {}): TicketRepo {
  const base: any = {
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => [{ codigo: 'TK-00002' }]),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      create: vi.fn(async (args: any) => ({
        id: '00000000-0000-0000-0000-0000000000aa',
        codigo: args.data.codigo,
        asunto: args.data.asunto,
        descripcion: args.data.descripcion,
        estado: args.data.estado,
        solicitanteId: args.data.solicitanteId,
        categoriaId: args.data.categoriaId,
        slaId: args.data.slaId,
        origen: args.data.origen,
        solicitante: { nombre: 'Juan', apellido: '', correo: 'juan@x.com' },
      })),
    },
    usuario: {
      findUnique: vi.fn(),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.correo?.equals === 'juan@x.com') {
          return { id: '00000000-0000-0000-0000-000000000001', correo: 'juan@x.com', nombre: 'Juan' }
        }
        return null
      }),
      create: vi.fn(async (args: any) => ({ id: 'new-user', ...args.data })),
    },
    rol: { findFirst: vi.fn(async () => ({ id: ROLE })) },
    categoria: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === CAT ? { id: CAT } : null)),
      findFirst: vi.fn(async () => ({ id: CAT })),
    },
    comentario: {
      create: vi.fn(async (args: any) => ({ id: 'c1', ...args.data })),
    },
    logTicket: { create: vi.fn(async (args: any) => ({ id: 'l1', ...args.data })) },
    adjunto: { createMany: vi.fn(async () => ({})) },
    sla: { findFirst: vi.fn(async () => ({ id: 'sla1' })) },
    cola: { findFirst: vi.fn() },
    ...overrides,
  }
  return base as TicketRepo
}

describe('adjuntosValidos', () => {
  it('limita a 10 archivos', () => {
    const muchos = Array.from({ length: 15 }, (_, i) => ({ content: 'x', filename: `a${i}.txt` }))
    expect(adjuntosValidos(muchos).length).toBe(10)
  })

  it('descarta archivos mayores a 10 MB', () => {
    const grande = { content: Buffer.alloc(11 * 1024 * 1024), filename: 'grande.bin' }
    const chico = { content: Buffer.alloc(1024), filename: 'chico.txt' }
    expect(adjuntosValidos([grande, chico])).toHaveLength(1)
    expect(adjuntosValidos([grande, chico])[0].filename).toBe('chico.txt')
  })
})

describe('decideIncomingEmail', () => {
  it('clasifica como respuesta si el asunto tiene código TK', () => {
    const d = decideIncomingEmail({ value: [{ address: 'a@x.com' }] }, 'RE: ayuda [TK-00012]')
    expect(d.kind).toBe('reply')
    expect(d.codigo).toBe('TK-00012')
  })

  it('clasifica como nuevo si no tiene código', () => {
    const d = decideIncomingEmail({ value: [{ address: 'a@x.com' }] }, 'Nueva solicitud')
    expect(d.kind).toBe('new')
    expect(d.codigo).toBeNull()
  })

  it('devuelve correo normalizado', () => {
    const d = decideIncomingEmail({ text: 'Ana <Ana@X.COM>' }, 'Hola')
    expect(d.fromEmail).toBe('ana@x.com')
  })
})

describe('handleIncomingEmail - correo nuevo', () => {
  it('crea ticket con código secuencial, adjuntos y SLA', async () => {
    const repo = makeRepo()
    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Mi laptop no enciende',
        text: 'Desde el apagón no enciende',
        attachments: [{ content: Buffer.from('foto'), contentType: 'image/png', filename: 'imagen.png' }],
      }
    )

    expect(result?.kind).toBe('new')
    expect(result?.codigo).toBe('TK-00003')
    expect(repo.ticket.create).toHaveBeenCalled()
    const createCall = (repo.ticket.create as any).mock.calls[0][0]
    expect(createCall.data.origen).toBe('CORREO')
    expect(createCall.data.slaId).toBe('sla1')
    expect(createCall.data.estado).toBe('NUEVO')
    expect(repo.adjunto.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ nombre: 'imagen.png', tipo: 'image/png' })]),
      })
    )
  })

  it('crea usuario nuevo si el remitente no existe', async () => {
    const repo = makeRepo()
    await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'nuevo@externo.com' }] },
        subject: 'Hola',
        text: 'cuerpo',
      }
    )
    expect(repo.usuario.create).toHaveBeenCalled()
    const createCall = (repo.usuario.create as any).mock.calls[0][0]
    expect(createCall.data.correo).toBe('nuevo@externo.com')
    expect(createCall.data.rolId).toBe(ROLE)
  })

  it('usa la primera categoría si no hay configurada', async () => {
    const repo = makeRepo()
    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Sin categoria',
        text: 'ok',
      }
    )
    expect(result).not.toBeNull()
    const call = (repo.ticket.create as any).mock.calls[0][0]
    expect(call.data.categoriaId).toBe(CAT)
  })

  it('asigna automáticamente al agente menos cargado cuando hay cola', async () => {
    const repo = makeRepo()
    ;(repo.categoria.findUnique as any).mockResolvedValue({ id: CAT, colaDefaultId: 'cola-1' })
    const autoAssign = vi.fn(async () => ({ id: 'agente-b', nombre: 'Bruno' }))

    await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, autoAssign, defaultCategoriaId: CAT },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Asignar por cola',
        text: 'cuerpo',
      }
    )

    expect(autoAssign).toHaveBeenCalledWith({ colaId: 'cola-1' })
    expect(repo.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expect.any(String) },
        data: { agenteId: 'agente-b', estado: 'ASIGNADO' },
      })
    )
    const calls = (repo.logTicket.create as any).mock.calls
    expect(calls.some((c: any) => c[0].data.accion === 'ASIGNACION' && c[0].data.valorNuevo === 'Bruno (agente-b)')).toBe(true)
  })

  it('registra el id del agente en el log si no tiene nombre', async () => {
    const repo = makeRepo()
    ;(repo.categoria.findUnique as any).mockResolvedValue({ id: CAT, colaDefaultId: 'cola-1' })
    const autoAssign = vi.fn(async () => ({ id: 'agente-x' }))

    await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, autoAssign, defaultCategoriaId: CAT },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Asignar sin nombre',
        text: 'cuerpo',
      }
    )

    const calls = (repo.logTicket.create as any).mock.calls
    expect(calls.some((c: any) => c[0].data.accion === 'ASIGNACION' && c[0].data.valorNuevo === 'agente-x')).toBe(true)
  })

  it('no asigna si no hay cola configurada en la categoría', async () => {
    const repo = makeRepo()
    ;(repo.categoria.findUnique as any).mockResolvedValue({ id: CAT, colaDefaultId: null })
    const autoAssign = vi.fn()
    await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, autoAssign, defaultCategoriaId: CAT },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Sin cola',
        text: 'cuerpo',
      }
    )
    expect(autoAssign).not.toHaveBeenCalled()
    expect(repo.ticket.update).not.toHaveBeenCalled()
  })

  it('si la asignación falla, no rompe la creación del ticket', async () => {
    const repo = makeRepo()
    ;(repo.categoria.findUnique as any).mockResolvedValue({ id: CAT, colaDefaultId: 'cola-1' })
    const autoAssign = vi.fn(async () => { throw new Error('db down') })

    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE, autoAssign, defaultCategoriaId: CAT },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'Falla asignación',
        text: 'cuerpo',
      }
    )

    expect(result?.kind).toBe('new')
    expect(repo.ticket.update).not.toHaveBeenCalled()
  })
})

describe('handleIncomingEmail - respuesta RE:', () => {
  it('crea comentario en el ticket original en vez de un ticket nuevo', async () => {
    const repo = makeRepo()
    ;(repo.ticket.findUnique as any).mockResolvedValue({
      id: 'ticket-1',
      codigo: 'TK-00012',
      solicitanteId: 'user-1',
    })

    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'RE: mi problema [TK-00012]',
        text: 'Sigue sin funcionar',
      }
    )

    expect(result?.kind).toBe('reply')
    expect(result?.ticketId).toBe('ticket-1')
    expect(repo.comentario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 'ticket-1',
          mensaje: 'Sigue sin funcionar',
          esInterno: false,
        }),
      })
    )
    expect(repo.ticket.create).not.toHaveBeenCalled()
  })

  it('guarda adjuntos de una respuesta en el comentario', async () => {
    const repo = makeRepo()
    ;(repo.ticket.findUnique as any).mockResolvedValue({
      id: 'ticket-1',
      codigo: 'TK-00012',
      solicitanteId: 'user-1',
    })

    await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'RE: adjunto [TK-00012]',
        text: 'aquí va',
        attachments: [{ content: 'pdf-bytes', contentType: 'application/pdf', filename: 'doc.pdf' }],
      }
    )

    const call = (repo.adjunto.createMany as any).mock.calls[0][0]
    expect(call.data[0]).toMatchObject({ ticketId: 'ticket-1', comentarioId: 'c1', nombre: 'doc.pdf' })
  })

  it('si la respuesta apunta a ticket inexistente, cae a flujo de ticket nuevo', async () => {
    const repo = makeRepo()
    ;(repo.ticket.findUnique as any).mockResolvedValue(null)

    const result = await handleIncomingEmail(
      { repo, resolveRoleId: async () => ROLE },
      {
        from: { value: [{ address: 'juan@x.com' }] },
        subject: 'RE: algo [TK-99999]',
        text: 'mensaje',
      }
    )

    expect(result?.kind).toBe('new')
    expect(repo.ticket.create).toHaveBeenCalled()
  })
})