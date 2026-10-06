import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { sendEmailViaGraph } from '../src/lib/mail/graph'
import {
  getMicrosoftAccessToken,
  getMicrosoftGraphAccessToken,
  GRAPH_SCOPES,
  microsoftAuthorizationUrl,
} from '../src/lib/mail/oauth'
import { sendEmail } from '../src/lib/mail/sender'
import { loadEmailConfig, saveEmailConfig, type EmailConfig } from '../src/lib/mail/config'
import nodemailer from 'nodemailer'

vi.mock('../src/lib/mail/config', () => ({
  loadEmailConfig: vi.fn(),
  saveEmailConfig: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}))

const baseConfig = (overrides: Partial<EmailConfig> = {}): EmailConfig =>
  ({
    authMode: 'oauth2',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    clientSecret: 'secret-1',
    refreshToken: 'RT_A',
    oauthMailbox: 'soporte@empresa.com',
    monitorAfter: '',
    enabled: true,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    imapUser: 'soporte@empresa.com',
    imapPass: '',
    imapFolder: 'INBOX',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromAddress: 'soporte@empresa.com',
    fromName: 'Soporte',
    checkInterval: 15,
    defaultCategoriaId: '',
    ...overrides,
  } as EmailConfig)

interface StubResult {
  ok?: boolean
  status?: number
  body?: unknown
}

interface FetchCall {
  url: string
  method?: string
  body?: string
  auth?: string
}

function stubFetch(...results: StubResult[]) {
  const calls: FetchCall[] = []
  let index = 0
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body,
      auth: init?.headers?.Authorization,
    })
    const result = results[Math.min(index, results.length - 1)] ?? { ok: true, status: 202, body: {} }
    index += 1
    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      json: async () => result.body ?? {},
    }
  }))
  return calls
}

function parsedBody(call: FetchCall) {
  return JSON.parse(call.body || '{}') as {
    message?: {
      subject?: string
      body?: { contentType?: string; content?: string }
      toRecipients?: { emailAddress?: { address?: string } }[]
      internetMessageHeaders?: { name?: string; value?: string }[]
    }
    saveToSentItems?: boolean
  }
}

function headerValue(body: ReturnType<typeof parsedBody>, name: string) {
  return body.message?.internetMessageHeaders?.find((h) => h.name === name)?.value
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('sendEmailViaGraph', () => {
  it('envía mensaje nuevo a /me/sendMail cuando no hay código de ticket', async () => {
    const calls = stubFetch({ status: 202, body: {} })

    await sendEmailViaGraph('AT_G', {
      to: 'cliente@empresa.com',
      subject: 'Reunión semanal',
      html: '<p>Hola</p>',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://graph.microsoft.com/v1.0/me/sendMail')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].auth).toBe('Bearer AT_G')

    const body = parsedBody(calls[0])
    expect(body.saveToSentItems).toBe(true)
    expect(body.message?.subject).toBe('Reunión semanal')
    expect(body.message?.body).toEqual({ contentType: 'HTML', content: '<p>Hola</p>' })
    expect(body.message?.toRecipients).toEqual([{ emailAddress: { address: 'cliente@empresa.com' } }])
    expect(body.message?.internetMessageHeaders).toBeUndefined()
    expect(headerValue(body, 'In-Reply-To')).toBeUndefined()
  })

  it('responde con createReply cuando el mensaje del hilo existe en el buzón', async () => {
    const calls = stubFetch(
      { body: { value: [{ id: 'GRAPH-MSG-1' }] } },
      { status: 201, body: { id: 'BORRADOR-1' } },
      { status: 202, body: {} },
    )

    await sendEmailViaGraph('AT_G', {
      to: 'cliente@empresa.com',
      subject: '[TK-99999] Re: consulta',
      html: '<p>Respuesta</p>',
      headers: { inReplyTo: 'abc@correo', references: 'raiz@correo abc@correo' },
    })

    expect(calls).toHaveLength(3)
    // Lookup por internetMessageId con los ángulos codificados para OData.
    expect(calls[0].url).toContain("internetMessageId eq '%3Cabc%40correo%3E'")
    expect(calls[1].url).toBe('https://graph.microsoft.com/v1.0/me/messages/GRAPH-MSG-1/createReply')
    expect(calls[1].method).toBe('POST')

    const draft = parsedBody(calls[1])
    expect(draft.message?.subject).toBe('[TK-99999] Re: consulta')
    expect(draft.message?.body).toEqual({ contentType: 'HTML', content: '<p>Respuesta</p>' })
    expect(draft.message?.toRecipients).toEqual([{ emailAddress: { address: 'cliente@empresa.com' } }])
    expect(draft.message?.internetMessageHeaders).toBeUndefined()

    expect(calls[2].url).toBe('https://graph.microsoft.com/v1.0/me/messages/BORRADOR-1/send')
  })

  it('si el mensaje del hilo no está en el buzón envía sin encadenar y lo advierte', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const calls = stubFetch({ body: { value: [] } }, { status: 202, body: {} })

    await sendEmailViaGraph('AT_G', {
      to: 'cliente@empresa.com',
      subject: '[TK-12345] Acuse',
      html: '<p>Acuse</p>',
      headers: { inReplyTo: 'tk-12345-root@empresa.com' },
    })

    expect(calls).toHaveLength(2)
    expect(calls[1].url).toBe('https://graph.microsoft.com/v1.0/me/sendMail')
    expect(parsedBody(calls[1]).message?.internetMessageHeaders).toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })

  it('con código de ticket pero sin cabeceras de hilo no busca y envía directo', async () => {
    const calls = stubFetch({ status: 202, body: {} })

    await sendEmailViaGraph('AT_G', {
      to: 'cliente@empresa.com',
      subject: '[TK-11111] Notificación',
      html: '<p>x</p>',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/sendMail')
  })

  it('propaga el error que devuelve Microsoft Graph', async () => {
    stubFetch({
      ok: false,
      status: 403,
      body: { error: { code: 'ErrorInsufficientPrivileges', message: 'No tiene permiso Mail.Send' } },
    })

    await expect(
      sendEmailViaGraph('AT_G', { to: 'a@b.c', subject: 'x', html: '<p>x</p>' }),
    ).rejects.toThrow(/403 ErrorInsufficientPrivileges.*No tiene permiso Mail\.Send/)
  })

  it('propaga el fallo al crear el borrador de respuesta', async () => {
    stubFetch(
      { body: { value: [{ id: 'GRAPH-MSG-1' }] } },
      { ok: false, status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Falta Mail.ReadWrite' } } },
    )

    await expect(
      sendEmailViaGraph('AT_G', {
        to: 'a@b.c',
        subject: '[TK-22222] x',
        html: '<p>x</p>',
        headers: { inReplyTo: 'abc@correo' },
      }),
    ).rejects.toThrow(/403 ErrorAccessDenied/)
  })
})

describe('getMicrosoftGraphAccessToken', () => {
  it('usa el scope Mail.Send de Graph y persiste el refresh token rotado', async () => {
    const calls = stubFetch({ body: { access_token: 'AT_G', refresh_token: 'RT_NUEVO' } })
    const onSave = vi.fn(async () => undefined)

    await expect(getMicrosoftGraphAccessToken(baseConfig(), onSave)).resolves.toBe('AT_G')

    expect(String(calls[0].url)).toContain('/oauth2/v2.0/token')
    const scope = new URLSearchParams(String(calls[0].body)).get('scope')
    expect(scope).toBe(GRAPH_SCOPES)
    expect(scope).toContain('https://graph.microsoft.com/Mail.Send')
    expect(scope).toContain('https://graph.microsoft.com/Mail.ReadWrite')
    expect(onSave).toHaveBeenCalledWith('RT_NUEVO')
  })

  it('orienta a conceder Mail.Send cuando Microsoft pide consentimiento', async () => {
    stubFetch({
      ok: false,
      body: {
        error: 'invalid_grant',
        error_description: 'AADSTS65001: The user or administrator has not consented to use the application',
      },
    })

    await expect(getMicrosoftGraphAccessToken(baseConfig())).rejects.toThrow(/Mail\.Send/)
  })

  it('sin credenciales lanza el mismo error claro de configuración', async () => {
    await expect(getMicrosoftGraphAccessToken(baseConfig({ clientId: '' }))).rejects.toThrow(/vuelve a conectar/)
  })
})

describe('microsoftAuthorizationUrl', () => {
  it('incluye los permisos de Graph en la autorización para concederlos al conectar', () => {
    const url = microsoftAuthorizationUrl(baseConfig(), 'http://localhost:3000/cb', 'st', 'no', 'soporte@empresa.com')

    expect(url).toContain(encodeURIComponent('https://graph.microsoft.com/Mail.Send'))
    expect(url).toContain(encodeURIComponent('https://graph.microsoft.com/Mail.ReadWrite'))
    expect(url).toContain(encodeURIComponent('https://outlook.office.com/IMAP.AccessAsUser.All'))
  })
})

describe('sendEmail (despacho)', () => {
  const mockedLoad = vi.mocked(loadEmailConfig)
  const mockedSave = vi.mocked(saveEmailConfig)
  const mockedTransport = vi.mocked(nodemailer.createTransport)

  beforeEach(() => {
    mockedLoad.mockResolvedValue(baseConfig())
    mockedSave.mockResolvedValue(undefined)
    mockedTransport.mockReset()
  })

  it('OAuth2 envía vía Graph y no crea transportador SMTP', async () => {
    const calls = stubFetch(
      { body: { access_token: 'AT_G', refresh_token: 'RT_ROTADO' } },
      { status: 202, body: {} },
    )

    await sendEmail('cliente@empresa.com', '[TK-11111] Acuse', '<p>Acuse</p>')

    expect(mockedTransport).not.toHaveBeenCalled()
    expect(calls).toHaveLength(2)
    expect(calls[1].url).toBe('https://graph.microsoft.com/v1.0/me/sendMail')
    expect(parsedBody(calls[1]).message?.subject).toBe('[TK-11111] Acuse')
    expect(mockedSave).toHaveBeenCalledWith({ refreshToken: 'RT_ROTADO' })
  })

  it('modo password usa SMTP y nunca toca Graph', async () => {
    mockedLoad.mockResolvedValue(baseConfig({ authMode: 'password', smtpUser: 'user', smtpPass: 'pass' }))
    const sendMail = vi.fn(async (options: unknown) => options)
    mockedTransport.mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>)
    const fetchMock = vi.fn(async () => { throw new Error('no debe llamarse a Graph') })
    vi.stubGlobal('fetch', fetchMock)

    await sendEmail('cliente@empresa.com', 'Asunto', '<p>x</p>')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockedTransport).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledTimes(1)
    const options = sendMail.mock.calls[0]?.[0] as { to?: string; subject?: string; html?: string }
    expect(options.to).toBe('cliente@empresa.com')
    expect(options.subject).toBe('Asunto')
  })

  it('sin fromAddress no envía ni lanza', async () => {
    mockedLoad.mockResolvedValue(baseConfig({ fromAddress: '' }))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async () => ({}))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendEmail('cliente@empresa.com', 'Asunto', '<p>x</p>')).resolves.toBeUndefined()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockedTransport).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('getMicrosoftAccessToken (flujo IMAP existente)', () => {
  it('sigue pidiendo el scope IMAP con el refresh token guardado', async () => {
    const calls = stubFetch({ body: { access_token: 'AT_IMAP' } })

    await expect(getMicrosoftAccessToken(baseConfig())).resolves.toBe('AT_IMAP')

    const scope = new URLSearchParams(String(calls[0].body)).get('scope')
    expect(scope).toContain('https://outlook.office.com/IMAP.AccessAsUser.All')
    expect(scope).not.toContain('graph.microsoft.com')
  })
})
