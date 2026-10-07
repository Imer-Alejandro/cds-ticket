import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMicrosoftAccessToken, MICROSOFT_SCOPES, clearMicrosoftTokenCache } from '../src/lib/mail/oauth'

const config = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
  refreshToken: 'RT_VIEJO',
} as any

function stubFetch(body: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn(async (...args: unknown[]): Promise<unknown> => {
    void args
    return { ok, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  // El caché de access tokens vive en memoria compartida: limpiarlo para que
  // cada test haga su propia petición de refresh.
  clearMicrosoftTokenCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('getMicrosoftAccessToken', () => {
  it('devuelve el access token usando el refresh token guardado', async () => {
    const fetchMock = stubFetch({ access_token: 'AT_1' })

    await expect(getMicrosoftAccessToken(config)).resolves.toBe('AT_1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, { body?: string }]
    expect(String(url)).toContain('/oauth2/v2.0/token')
    expect(String(init.body)).toContain('grant_type=refresh_token')
    expect(String(init.body)).toContain('refresh_token=RT_VIEJO')
    expect(decodeURIComponent(String(init.body).replace(/\+/g, ' '))).toContain(MICROSOFT_SCOPES)
  })

  it('persiste el refresh token cuando Microsoft lo rota', async () => {
    stubFetch({ access_token: 'AT_1', refresh_token: 'RT_NUEVO' })
    const onSave = vi.fn(async () => undefined)

    await expect(getMicrosoftAccessToken(config, onSave)).resolves.toBe('AT_1')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('RT_NUEVO')
  })

  it('no persiste si el refresh token no cambió', async () => {
    stubFetch({ access_token: 'AT_1', refresh_token: 'RT_VIEJO' })
    const onSave = vi.fn(async () => undefined)

    await getMicrosoftAccessToken(config, onSave)

    expect(onSave).not.toHaveBeenCalled()
  })

  it('no persiste si Microsoft no devuelve refresh token', async () => {
    stubFetch({ access_token: 'AT_1' })
    const onSave = vi.fn(async () => undefined)

    await getMicrosoftAccessToken(config, onSave)

    expect(onSave).not.toHaveBeenCalled()
  })

  it('no revienta la revisión si persistir el refresh token falla', async () => {
    stubFetch({ access_token: 'AT_1', refresh_token: 'RT_NUEVO' })
    const onSave = vi.fn(async () => { throw new Error('BD caída') })

    await expect(getMicrosoftAccessToken(config, onSave)).resolves.toBe('AT_1')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('sin credenciales completa del servidor lanza un error claro', async () => {
    await expect(getMicrosoftAccessToken({ ...config, clientId: '' })).rejects.toThrow(/MICROSOFT_/)
    await expect(getMicrosoftAccessToken({ ...config, refreshToken: '' })).rejects.toThrow(/vuelve a conectar/)
  })

  it('propaga el error que devuelve Microsoft (p. ej. refresh token inválido)', async () => {
    stubFetch({ error: 'invalid_grant', error_description: 'AADSTS70000: Refresh token expired' }, false)

    await expect(getMicrosoftAccessToken(config)).rejects.toThrow('AADSTS70000: Refresh token expired')
  })
})
