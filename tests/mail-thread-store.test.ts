import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { ticket: { findUnique, update } },
}))

import { recordOutboundMessage } from '../src/lib/mail/thread-store'

describe('recordOutboundMessage', () => {
  beforeEach(() => {
    findUnique.mockReset()
    update.mockReset()
  })

  it('con root fija el ancla cuando no existe y apunta ultimoMessageId', async () => {
    findUnique.mockResolvedValue({ messageId: null, threadRefs: null })
    await recordOutboundMessage('t-1', '<MSG-A@host>', true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { messageId: 'MSG-A@host', ultimoMessageId: 'MSG-A@host', threadRefs: 'MSG-A@host' },
    })
  })

  it('con root respeta el ancla previa y acumula threadRefs', async () => {
    findUnique.mockResolvedValue({ messageId: 'ROOT@host', threadRefs: 'ROOT@host' })
    await recordOutboundMessage('t-1', 'MSG-B@host', true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        messageId: 'ROOT@host',
        ultimoMessageId: 'MSG-B@host',
        threadRefs: 'ROOT@host MSG-B@host',
      },
    })
  })

  it('sin root no escribe nada (no desplaza el hilo del cliente)', async () => {
    await recordOutboundMessage('t-1', 'MSG-C@host', false)
    expect(findUnique).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('ignora tickets o Message-IDs vacíos', async () => {
    await recordOutboundMessage('', 'MSG@host', true)
    await recordOutboundMessage('t-1', '  ', true)
    expect(update).not.toHaveBeenCalled()
  })

  it('no falla si el ticket no existe', async () => {
    findUnique.mockResolvedValue(null)
    await recordOutboundMessage('t-x', 'MSG@host', true)
    expect(update).not.toHaveBeenCalled()
  })

  it('traga los errores de persistencia para no romper el envío', async () => {
    findUnique.mockResolvedValue({ messageId: null, threadRefs: null })
    update.mockRejectedValue(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(recordOutboundMessage('t-1', 'MSG@host', true)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
