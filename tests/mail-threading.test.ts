import { describe, it, expect, vi } from 'vitest'
import { extractTicketCode, isReplyEmail, cleanReplyText } from '../src/lib/mail/core'
import { handleIncomingEmail, decideIncomingEmail } from '../src/lib/mail/ingest'

describe('mail-threading & cleanReplyText', () => {
  it('limpia las citas de correo anterior en español e inglés', () => {
    const rawReply = `Hola, ya probé lo indicado y funcionó. Muchas gracias.

El 7 sep 2026 a las 14:00, Soporte <soporte@empresa.com> escribió:
> Hola Juan, por favor intenta reiniciar el equipo.
> -----Mensaje original-----
> De: Juan <juan@cliente.com>`

    const cleaned = cleanReplyText(rawReply)
    expect(cleaned).toBe('Hola, ya probé lo indicado y funcionó. Muchas gracias.')
  })

  it('limpia citas con marcador -----Original Message-----', () => {
    const rawReply = `Adjunto la información solicitada.

-----Original Message-----
From: Agent <agent@support.com>
Sent: Monday, September 7, 2026
Subject: [TK-00005] Consulta`

    const cleaned = cleanReplyText(rawReply)
    expect(cleaned).toBe('Adjunto la información solicitada.')
  })

  it('extrae el código de ticket desde las cabeceras inReplyTo o references', () => {
    const codeFromHeader = extractTicketCode(
      'Consulta urgente',
      { inReplyTo: '<tk-00042-root@cds-ticket.com>', references: '<tk-00042-root@cds-ticket.com>' }
    )
    expect(codeFromHeader).toBe('TK-00042')

    const decision = decideIncomingEmail('juan@mail.com', 'Respuesta a soporte', {
      references: '<tk-00088-root@domain.com>',
    })
    expect(decision.kind).toBe('reply')
    expect(decision.codigo).toBe('TK-00088')
  })

  it('agrega la etiqueta "Solicitante respondió" y no duplica el ticket', async () => {
    const mockTicket = { id: 't1', codigo: 'TK-00100', solicitanteId: 'u1' }
    const createdComments: any[] = []
    const createdLabels: any[] = []
    const linkedLabels: any[] = []

    const mockRepo: any = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(mockTicket),
        create: vi.fn(),
      },
      comentario: {
        create: vi.fn().mockImplementation((args) => {
          createdComments.push(args.data)
          return { id: 'c1', ...args.data }
        }),
      },
      logTicket: { create: vi.fn().mockResolvedValue({}) },
      adjunto: { createMany: vi.fn().mockResolvedValue({}) },
      etiqueta: {
        findFirst: vi.fn().mockResolvedValue({ id: 'lbl-1', nombre: 'Solicitante respondió' }),
        create: vi.fn().mockImplementation((args) => {
          createdLabels.push(args.data)
          return { id: 'lbl-1', ...args.data }
        }),
      },
      ticketEtiqueta: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          linkedLabels.push(args.data)
          return args.data
        }),
      },
    }

    const email = {
      from: 'juan@cliente.com',
      subject: 'Re: problema solucionado [TK-00100]',
      text: 'Excelente servicio, todo listo.\n\nDe: Soporte <soporte@empresa.com>',
    }

    const result = await handleIncomingEmail({ repo: mockRepo }, email)

    expect(result?.kind).toBe('reply')
    expect(result?.codigo).toBe('TK-00100')

    expect(createdComments.length).toBe(1)
    expect(createdComments[0].mensaje).toBe('Excelente servicio, todo listo.')

    expect(linkedLabels.length).toBe(1)
    expect(linkedLabels[0].ticketId).toBe('t1')
    expect(linkedLabels[0].etiquetaId).toBe('lbl-1')
  })
})
