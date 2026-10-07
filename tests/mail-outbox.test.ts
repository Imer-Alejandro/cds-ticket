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

  it('las cabeceras de hilo llegan intactas al transporte', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const box = createTestOutbox(send)

    box.enqueue({
      to: 'a@x.com',
      subject: '[TK-00001] Respuesta',
      html: 'h',
      inReplyTo: '<previo@mail>',
      references: '<raiz@mail> <previo@mail>',
    })
    await box.flush()

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        inReplyTo: '<previo@mail>',
        references: '<raiz@mail> <previo@mail>',
      })
    )
  })

  it('los adjuntos llegan intactos al transporte', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const box = createTestOutbox(send)
    const adjuntos = [{ nombre: 'captura.png', tipo: 'image/png', data: 'QUJD' }]

    box.enqueue({ to: 'a@x.com', subject: 'Con archivo', html: 'h', attachments: adjuntos })
    await box.flush()

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ attachments: adjuntos }))
  })

  it('envía en paralelo: un mensaje lento no frena a los demás', async () => {
    let release!: () => void
    const slow = new Promise<void>((resolve) => { release = resolve })
    const send = vi.fn(async (m: { to: string }) => {
      if (m.to === 'slow@x.com') await slow
    })
    const box = createOutbox({ send, concurrency: 3, enabled: () => true })

    box.enqueue({ to: 'slow@x.com', subject: 'Lento', html: 'h' })
    box.enqueue({ to: 'fast@x.com', subject: 'Rápido', html: 'h' })

    // El segundo mensaje termina aunque el primero siga en curso.
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    release()
    await box.flush()
    expect(box.stats().sent).toBe(2)
  })

  it('un reintento pendiente no frena a los demás mensajes', async () => {
    const order: string[] = []
    const send = vi.fn(async (m: { to: string }) => {
      order.push(m.to)
      if (m.to === 'flaky@x.com' && send.mock.calls.length === 1) {
        throw new Error('caída puntual')
      }
    })
    const box = createOutbox({ send, maxRetries: 1, retryDelayMs: 50, enabled: () => true })

    box.enqueue({ to: 'flaky@x.com', subject: 'Reintenta', html: 'h' })
    box.enqueue({ to: 'fast@x.com', subject: 'Rápido', html: 'h' })
    await box.flush()

    // flaky falla → fast se envía → flaky reintenta con éxito, sin bloquear a fast.
    expect(order).toEqual(['flaky@x.com', 'fast@x.com', 'flaky@x.com'])
    expect(box.stats().sent).toBe(2)
    expect(box.stats().failed).toBe(0)
  })
})