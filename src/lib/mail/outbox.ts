/**
 * Cola simple de envío de correos en memoria, con reintentos y sin bloquear
 * el flujo principal. El transportador real se inyecta para poder testear.
 */
export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export type SendFn = (msg: EmailMessage) => Promise<void>

export interface OutboxDeps {
  send: SendFn
  maxRetries?: number
  retryDelayMs?: number
  enabled?: () => boolean
}

export interface OutboxStats {
  pending: number
  sent: number
  failed: number
}

class EmailOutbox {
  private queue: EmailMessage[] = []
  private currentFlush: Promise<void> | null = null
  private sendFn: SendFn
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly enabled: () => boolean
  private retryCount = new WeakMap<EmailMessage, number>()
  private sentCount = 0
  private failedCount = 0

  constructor(deps: OutboxDeps) {
    this.sendFn = deps.send
    this.maxRetries = deps.maxRetries ?? 3
    this.retryDelayMs = deps.retryDelayMs ?? 500
    this.enabled = deps.enabled ?? (() => true)
  }

  enqueue(msg: EmailMessage): void {
    if (!this.enabled()) return
    this.queue.push(msg)
    void this.flush()
  }

  flush(): Promise<void> {
    if (this.currentFlush) return this.currentFlush
    this.currentFlush = this.runFlush().finally(() => {
      this.currentFlush = null
    })
    return this.currentFlush
  }

  private async runFlush(): Promise<void> {
    while (this.queue.length > 0) {
      const msg = this.queue.shift()!
      try {
        await this.sendFn(msg)
        this.sentCount++
      } catch {
        const attempts = (this.retryCount.get(msg) ?? 0) + 1
        if (attempts <= this.maxRetries) {
          this.retryCount.set(msg, attempts)
          this.queue.push(msg)
          await new Promise(r => setTimeout(r, this.retryDelayMs))
        } else {
          this.failedCount++
          this.retryCount.delete(msg)
        }
      }
    }
  }

  stats(): OutboxStats {
    return { pending: this.queue.length, sent: this.sentCount, failed: this.failedCount }
  }

  clear(): void {
    this.queue = []
    this.retryCount = new WeakMap()
  }
}

export function createOutbox(deps: OutboxDeps): EmailOutbox {
  return new EmailOutbox(deps)
}

export type EmailOutboxInstance = EmailOutbox