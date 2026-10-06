import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runMailCheck, type MailCheckHooks, type MailCheckStatus } from '../src/lib/mail/check'
import { getMicrosoftAccessToken } from '../src/lib/mail/oauth'
import type { EmailConfig } from '../src/lib/mail/config'

vi.mock('../src/lib/mail/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/mail/oauth')>()
  return { ...actual, getMicrosoftAccessToken: vi.fn(async () => 'ACCESS_TOKEN') }
})

const MONITOR_AFTER = '2026-01-01T00:00:00.000Z'

function makeConfig(overrides: Partial<EmailConfig> = {}): EmailConfig {
  return {
    authMode: 'password',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    oauthMailbox: '',
    monitorAfter: MONITOR_AFTER,
    enabled: true,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    imapUser: 'tickets@x.com',
    imapPass: 'secret',
    imapFolder: 'INBOX',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromAddress: 'tickets@x.com',
    fromName: 'Help Desk',
    checkInterval: 15,
    defaultCategoriaId: '',
    ...overrides,
  }
}

type HooksWithSpies = MailCheckHooks & {
  loadConfig: ReturnType<typeof vi.fn>
  ingest: ReturnType<typeof vi.fn>
  onResult: ReturnType<typeof vi.fn>
  saveMonitorAfter: ReturnType<typeof vi.fn>
  saveStatus: ReturnType<typeof vi.fn>
  saveRefreshToken: ReturnType<typeof vi.fn>
  log: ReturnType<typeof vi.fn>
  errorLog: ReturnType<typeof vi.fn>
}

function makeHooks(overrides: Partial<MailCheckHooks> = {}): HooksWithSpies {
  const hooks = {
    loadConfig: vi.fn(async () => makeConfig()),
    ingest: vi.fn(async () => ({ kind: 'new', ticketId: 't1', codigo: 'TK-00001' })),
    onResult: vi.fn(async () => undefined),
    saveMonitorAfter: vi.fn(async () => undefined),
    saveStatus: vi.fn(async () => undefined),
    saveRefreshToken: vi.fn(async () => undefined),
    log: vi.fn(),
    errorLog: vi.fn(),
    ...overrides,
  }
  return hooks as HooksWithSpies
}

function makeFakeClient(opts: { candidates?: number[]; metadata?: { seq: number; internalDate: Date }[] } = {}) {
  const seen: number[] = []
  const client = {
    connect: vi.fn(async () => undefined),
    getMailboxLock: vi.fn(async () => ({ release: vi.fn() })),
    search: vi.fn(async () => opts.candidates ?? []),
    fetchAll: vi.fn(async () => opts.metadata ?? []),
    download: vi.fn(async (seq: string) => ({
      content: (async function* () { yield Buffer.from(`raw-${seq}`) })(),
    })),
    messageFlagsAdd: vi.fn(async (seq: number) => { seen.push(seq) }),
    logout: vi.fn(async () => undefined),
  }
  return { client, seen }
}

function lastStatus(hooks: HooksWithSpies): MailCheckStatus {
  const call = hooks.saveStatus.mock.calls.at(-1)
  expect(call, 'saveStatus debe registrarse en cada revisión').toBeTruthy()
  return call![0] as MailCheckStatus
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runMailCheck — líneas base y configuración', () => {
  it('OAuth2 sin monitorAfter: establece la línea base y NO conecta (no importa histórico)', async () => {
    const hooks = makeHooks({
      loadConfig: vi.fn(async () => makeConfig({ authMode: 'oauth2', monitorAfter: '' })),
    })
    const { client } = makeFakeClient()
    const createClient = vi.fn(() => client as any)

    const status = await runMailCheck({ ...hooks, createClient })

    expect(status.baseline).toBe(true)
    expect(status.ok).toBe(true)
    expect(hooks.saveMonitorAfter).toHaveBeenCalledTimes(1)
    expect(Date.parse(hooks.saveMonitorAfter.mock.calls[0][0])).not.toBeNaN()
    expect(createClient).not.toHaveBeenCalled()
    expect(lastStatus(hooks).baseline).toBe(true)
  })

  it('password sin monitorAfter: también establece la línea base en la primera revisión', async () => {
    const hooks = makeHooks({
      loadConfig: vi.fn(async () => makeConfig({ authMode: 'password', monitorAfter: '' })),
    })
    const { client } = makeFakeClient()
    const createClient = vi.fn(() => client as any)

    const status = await runMailCheck({ ...hooks, createClient })

    expect(status.baseline).toBe(true)
    expect(hooks.saveMonitorAfter).toHaveBeenCalledTimes(1)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('con recepción desactivada no conecta y lo deja claro en el estado', async () => {
    const hooks = makeHooks({ loadConfig: vi.fn(async () => makeConfig({ enabled: false })) })
    const createClient = vi.fn()

    const status = await runMailCheck({ ...hooks, createClient })

    expect(createClient).not.toHaveBeenCalled()
    expect(status.ok).toBe(true)
    expect(status.message).toMatch(/desactivada/i)
    expect(hooks.log).toHaveBeenCalled()
    expect(lastStatus(hooks).message).toMatch(/desactivada/i)
  })

  it('falta el servidor IMAP: error explícito y sin conexión (antes salía en silencio)', async () => {
    const hooks = makeHooks({ loadConfig: vi.fn(async () => makeConfig({ imapHost: '' })) })
    const createClient = vi.fn()

    const status = await runMailCheck({ ...hooks, createClient })

    expect(status.ok).toBe(false)
    expect(status.message).toMatch(/Servidor IMAP/)
    expect(createClient).not.toHaveBeenCalled()
    expect(hooks.errorLog).toHaveBeenCalled()
  })

  it('falta el usuario IMAP: error explícito y sin conexión', async () => {
    const hooks = makeHooks({ loadConfig: vi.fn(async () => makeConfig({ imapUser: '  ' })) })
    const status = await runMailCheck({ ...hooks, createClient: vi.fn() })
    expect(status.ok).toBe(false)
    expect(status.message).toMatch(/Usuario/)
  })

  it('mailbox de Microsoft distinto del usuario IMAP: no conecta y reporta el motivo', async () => {
    const hooks = makeHooks({
      loadConfig: vi.fn(async () => makeConfig({ authMode: 'oauth2', oauthMailbox: 'otra@x.com' })),
    })
    const createClient = vi.fn()

    const status = await runMailCheck({ ...hooks, createClient })

    expect(status.ok).toBe(false)
    expect(status.message).toMatch(/no coincide/)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('password sin contraseña: error explícito y sin conexión', async () => {
    const hooks = makeHooks({ loadConfig: vi.fn(async () => makeConfig({ imapPass: '' })) })
    const createClient = vi.fn()

    const status = await runMailCheck({ ...hooks, createClient })

    expect(status.ok).toBe(false)
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('runMailCheck — conexión y proceso', () => {
  it('modo oauth2 usa accessToken y entrega el guardador de refresh token a Microsoft', async () => {
    const hooks = makeHooks({
      loadConfig: vi.fn(async () => makeConfig({ authMode: 'oauth2' })),
    })
    const { client } = makeFakeClient()

    await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(getMicrosoftAccessToken).toHaveBeenCalledTimes(1)
    const [cfgArg, saveArg] = (getMicrosoftAccessToken as any).mock.calls[0]
    expect(cfgArg.authMode).toBe('oauth2')
    expect(saveArg).toBe(hooks.saveRefreshToken)
    expect(client.connect).toHaveBeenCalled()
  })

  it('conecta con pass en modo password', async () => {
    const hooks = makeHooks()
    const { client } = makeFakeClient()
    let authReceived: any = null

    await runMailCheck({
      ...hooks,
      createClient: (_cfg, auth) => {
        authReceived = auth
        return client as any
      },
    })

    expect(authReceived).toEqual({ user: 'tickets@x.com', pass: 'secret' })
    expect(authReceived.accessToken).toBeUndefined()
  })

  it('busca solo no leídos desde monitorAfter y omite el histórico anterior', async () => {
    const hooks = makeHooks()
    const { client, seen } = makeFakeClient({
      candidates: [1, 2],
      metadata: [
        { seq: 1, internalDate: new Date('2025-05-05T10:00:00.000Z') },
        { seq: 2, internalDate: new Date('2026-01-02T10:00:00.000Z') },
      ],
    })

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(client.search).toHaveBeenCalledWith({ seen: false, since: new Date(MONITOR_AFTER) })
    expect(hooks.ingest).toHaveBeenCalledTimes(1)
    expect(seen).toEqual([2])
    expect(status.found).toBe(1)
    expect(status.processed).toBe(1)
    expect(hooks.onResult).toHaveBeenCalledTimes(1)
    expect(hooks.onResult.mock.calls[0][0]).toMatchObject({ codigo: 'TK-00001' })
  })

  it('marca \\Seen aunque el correo se ignore (evita reprocesar en bucle)', async () => {
    const hooks = makeHooks({ ingest: vi.fn(async () => null) })
    const { client, seen } = makeFakeClient({
      candidates: [1],
      metadata: [{ seq: 1, internalDate: new Date('2026-01-02T10:00:00.000Z') }],
    })

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(seen).toEqual([1])
    expect(status.ignored).toBe(1)
    expect(status.processed).toBe(0)
    expect(hooks.onResult).not.toHaveBeenCalled()
  })

  it('un error al procesar un correo NO marca \\Seen y no detiene el resto', async () => {
    const hooks = makeHooks({
      ingest: vi.fn()
        .mockRejectedValueOnce(new Error('BD caída'))
        .mockResolvedValueOnce({ kind: 'new', ticketId: 't2', codigo: 'TK-00002' }),
    })
    const { client, seen } = makeFakeClient({
      candidates: [1, 2],
      metadata: [
        { seq: 1, internalDate: new Date('2026-01-02T10:00:00.000Z') },
        { seq: 2, internalDate: new Date('2026-01-02T11:00:00.000Z') },
      ],
    })

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(seen).toEqual([2])
    expect(status.errors).toBe(1)
    expect(status.processed).toBe(1)
    expect(hooks.errorLog).toHaveBeenCalled()
    expect(client.logout).toHaveBeenCalled()
  })

  it('una falla al notificar se registra pero el ticket ya quedó procesado', async () => {
    const hooks = makeHooks({ onResult: vi.fn(async () => { throw new Error('socket caído') }) })
    const { client, seen } = makeFakeClient({
      candidates: [1],
      metadata: [{ seq: 1, internalDate: new Date('2026-01-02T10:00:00.000Z') }],
    })

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(seen).toEqual([1])
    expect(status.processed).toBe(1)
    expect(status.errors).toBe(1)
  })

  it('sin correos no leídos reporta 0 y sigue ok', async () => {
    const hooks = makeHooks()
    const { client } = makeFakeClient({ candidates: [], metadata: [] })

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(status.ok).toBe(true)
    expect(status.found).toBe(0)
    expect(status.message).toMatch(/Sin correos/)
    expect(hooks.ingest).not.toHaveBeenCalled()
    expect(client.logout).toHaveBeenCalled()
  })

  it('un fallo al conectar queda registrado en el estado y en el log de errores', async () => {
    const hooks = makeHooks()
    const client = {
      connect: vi.fn(async () => { throw new Error('LOGIN failed') }),
      getMailboxLock: vi.fn(),
      search: vi.fn(),
      fetchAll: vi.fn(),
      download: vi.fn(),
      messageFlagsAdd: vi.fn(),
      logout: vi.fn(async () => undefined),
    }

    const status = await runMailCheck({ ...hooks, createClient: () => client as any })

    expect(status.ok).toBe(false)
    expect(status.message).toMatch(/LOGIN failed/)
    expect(hooks.errorLog).toHaveBeenCalled()
    expect(client.logout).toHaveBeenCalled()
  })

  it('siempre persiste el estado de la revisión', async () => {
    const hooks = makeHooks({ loadConfig: vi.fn(async () => makeConfig({ enabled: false })) })
    await runMailCheck(hooks)
    const status = lastStatus(hooks)
    expect(status.at).toBeTruthy()
    expect(Date.parse(status.at)).not.toBeNaN()
    expect(status.mode).toBe('password')
    expect(status.folder).toBe('INBOX')
  })
})
