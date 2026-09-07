import { describe, it, expect, vi } from 'vitest'
import { createOutbox } from '../src/lib/mail/outbox'
import { createTestOutbox } from '../src/lib/mail/sender'

describe('email outbox', () => {
  it('envía los mensajes encolados', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const box = createTestOutbox(send)

    box.enqueue({ to: 'a@x.com', subject: 'S1', html: 'h1' })
    box.enqueue({ to: 'b@x.com', subject: 'S2', html: 'h2' })
    await box.flush()

    expect(send).toHaveBeenCalledTimes(2)
    expect(box.stats().sent).toBe(2)
    expect(box.stats().failed).toBe(0)
    expect(box.stats().pending).toBe(0)
  })

  it('reintenta y marca como fallido tras agotar reintentos', async () => {
    const send = vi.fn().mockRejectedValue(new Error('SMTP down'))
    const box = createOutbox({
      send,
      maxRetries: 2,
      retryDelayMs: 1,
      enabled: () => true,
    })

    box.enqueue({ to: 'a@x.com', subject: 'S', html: 'h' })
    await box.flush()

    expect(send).toHaveBeenCalledTimes(3) // 1 inicial + 2 reintentos
    expect(box.stats().failed).toBe(1)
    expect(box.stats().sent).toBe(0)
  })

  it('no encola si está deshabilitado', async () => {
    const send = vi.fn()
    const box = createOutbox({ send, enabled: () => false })

    box.enqueue({ to: 'a@x.com', subject: 'S', html: 'h' })
    await box.flush()

    expect(send).not.toHaveBeenCalled()
    expect(box.stats().pending).toBe(0)
  })

  it('recupera el mensaje si el reintento tiene éxito', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(undefined)
    const box = createOutbox({ send, maxRetries: 3, retryDelayMs: 1, enabled: () => true })

    box.enqueue({ to: 'a@x.com', subject: 'S', html: 'h' })
    await box.flush()

    expect(send).toHaveBeenCalledTimes(2)
    expect(box.stats().sent).toBe(1)
    expect(box.stats().failed).toBe(0)
  })
})