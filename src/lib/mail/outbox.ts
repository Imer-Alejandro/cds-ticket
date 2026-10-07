/**
 * Cola de envío de correos en memoria, con reintentos y sin bloquear
 * el flujo principal. El transportador real se inyecta para poder testear.
 * Los envíos corren en paralelo (hasta `concurrency`) para que un correo
 * lento (Graph hace varias llamadas HTTP) no retrase a los demás.
 */
export interface EmailAttachment {
  /** Nombre del archivo tal como se verá en el correo. */
  nombre: string
  /** Tipo MIME (image/png, application/pdf, …). */
  tipo: string
  /** Contenido en base64 SIN prefijo data:. */
  data: string
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  /** Cabeceras de hilo SMTP (Message-ID de referencia de la rama). */
  inReplyTo?: string | null
  /** Cadena References completa (space-separated, con ángulos). */
  references?: string | null
  /** Adjuntos opcionales (archivos binarios en base64). */
  attachments?: EmailAttachment[]
}

export type SendFn = (msg: EmailMessage) => Promise<void>

export interface OutboxDeps {
  send: SendFn
  maxRetries?: number
  retryDelayMs?: number
  enabled?: () => boolean
  /** Envíos simultáneos máximos (por defecto 3). */
  concurrency?: number
}

export interface OutboxStats {
  pending: number
  sent: number
  failed: number
}

class EmailOutbox {
  private queue: EmailMessage[] = []
  private sendFn: SendFn
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly maxConcurrent: number
  private readonly enabled: () => boolean
  private retryCount = new WeakMap<EmailMessage, number>()
  private active = 0
  private scheduledRetries = 0
  private idleWaiters: Array<() => void> = []
  private retryTimers = new Set<ReturnType<typeof setTimeout>>()
  private sentCount = 0
  private failedCount = 0

  constructor(deps: OutboxDeps) {
    this.sendFn = deps.send
    this.maxRetries = deps.maxRetries ?? 3
    this.retryDelayMs = deps.retryDelayMs ?? 500
    this.maxConcurrent = deps.concurrency ?? 3
    this.enabled = deps.enabled ?? (() => true)
  }

  enqueue(msg: EmailMessage): void {
    if (!this.enabled()) return
    this.queue.push(msg)
    this.pump()
  }

  /** Resuelve cuando no queda nada en curso (ni reintentos programados). */
  flush(): Promise<void> {
    if (this.isIdle()) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private isIdle(): boolean {
    return this.active === 0 && this.queue.length === 0 && this.scheduledRetries === 0
  }

  private notifyIfIdle(): void {
    if (!this.isIdle()) return
    const waiters = this.idleWaiters
    this.idleWaiters = []
    for (const resolve of waiters) resolve()
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const msg = this.queue.shift()!
      this.active++
      void this.process(msg).finally(() => {
        this.active--
        this.pump()
        this.notifyIfIdle()
      })
    }
    this.notifyIfIdle()
  }

  private async process(msg: EmailMessage): Promise<void> {
    const start = Date.now()
    try {
      await this.sendFn(msg)
      this.sentCount++
      console.log(`[Mail] enviado en ${Date.now() - start}ms → ${msg.to} (asunto: ${msg.subject})`)
    } catch (err) {
      const attempts = (this.retryCount.get(msg) ?? 0) + 1
      if (attempts <= this.maxRetries) {
        this.retryCount.set(msg, attempts)
        // El reintento se programa fuera del worker: no frena a los demás.
        this.scheduledRetries++
        const timer = setTimeout(() => {
          this.retryTimers.delete(timer)
          this.scheduledRetries--
          this.queue.push(msg)
          this.pump()
          this.notifyIfIdle()
        }, this.retryDelayMs)
        this.retryTimers.add(timer)
      } else {
        this.failedCount++
        this.retryCount.delete(msg)
        console.error(
          `[Mail] Email a ${msg.to} falló tras ${this.maxRetries} reintentos (asunto: ${msg.subject}, ${Date.now() - start}ms):`,
          err
        )
      }
    }
  }

  stats(): OutboxStats {
    return { pending: this.queue.length + this.scheduledRetries, sent: this.sentCount, failed: this.failedCount }
  }

  clear(): void {
    this.queue = []
    this.retryCount = new WeakMap()
    for (const timer of this.retryTimers) clearTimeout(timer)
    this.retryTimers.clear()
    this.scheduledRetries = 0
  }
}

export function createOutbox(deps: OutboxDeps): EmailOutbox {
  return new EmailOutbox(deps)
}

export type EmailOutboxInstance = EmailOutbox
