import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  consumePasswordResetToken,
  passwordResetUrl,
  validateNewPassword,
  PASSWORD_RESET_TTL_MS,
} from '../src/lib/password-reset'
import { resetPasswordEmail } from '../src/lib/mail/templates'
import { POST as forgotPOST } from '../src/app/api/auth/forgot/route'
import { POST as resetPOST } from '../src/app/api/auth/reset/route'

const { configuracion, usuario, enqueueEmail } = vi.hoisted(() => ({
  configuracion: { upsert: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  usuario: { findUnique: vi.fn(), update: vi.fn() },
  enqueueEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: { configuracion, usuario } }))
vi.mock('../src/lib/mail/sender', () => ({ enqueueEmail }))

// Estado en memoria que imita la tabla Configuracion.
let markers: Map<string, string>

function installConfigMock() {
  configuracion.upsert.mockImplementation(
    async ({ where, create }: { where: { clave: string }; create: { valor: string; grupo: string } }) => {
      markers.set(where.clave, create.valor)
      return { id: 'cfg-1', clave: where.clave, valor: create.valor, grupo: create.grupo }
    }
  )
  configuracion.findUnique.mockImplementation(async ({ where }: { where: { clave: string } }) =>
    markers.has(where.clave)
      ? { id: 'cfg-1', clave: where.clave, valor: markers.get(where.clave), grupo: 'password_reset' }
      : null
  )
  configuracion.deleteMany.mockImplementation(async ({ where }: { where: { clave: string } }) => {
    const borrado = markers.delete(where.clave) ? 1 : 0
    return { count: borrado }
  })
}

function forgotRequest(email?: string) {
  return new Request('http://localhost:3000/api/auth/forgot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(email === undefined ? {} : { email }),
  })
}

function resetRequest(token: string, password: string) {
  return new Request('http://localhost:3000/api/auth/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_development_only_1234567890'

beforeEach(() => {
  vi.clearAllMocks()
  markers = new Map()
  installConfigMock()
})

describe('createPasswordResetToken / verifyPasswordResetToken', () => {
  it('crea un token verificable que devuelve el usuarioId', async () => {
    const token = await createPasswordResetToken('u-1')

    await expect(verifyPasswordResetToken(token)).resolves.toBe('u-1')
    expect(configuracion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clave: 'password_reset:u-1' } })
    )
  })

  it('el enlace deja de servir tras consumerlo (uso único)', async () => {
    const token = await createPasswordResetToken('u-1')

    await expect(consumePasswordResetToken(token)).resolves.toBe('u-1')
    await expect(consumePasswordResetToken(token)).resolves.toBeNull()
    await expect(verifyPasswordResetToken(token)).resolves.toBeNull()
  })

  it('pedir uno nuevo invalida el enlace anterior', async () => {
    const primero = await createPasswordResetToken('u-1')
    const segundo = await createPasswordResetToken('u-1')

    await expect(verifyPasswordResetToken(primero)).resolves.toBeNull()
    await expect(verifyPasswordResetToken(segundo)).resolves.toBe('u-1')
  })

  it('rechaza tokens expirados aunque su jti siga vigente', async () => {
    const token = await createPasswordResetToken('u-1')
    const jti = markers.get('password_reset:u-1')!
    const expirado = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setAudience('password-reset')
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime('-10s')
      .sign(new TextEncoder().encode(JWT_SECRET))
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000)

    await expect(verifyPasswordResetToken(expirado)).resolves.toBeNull()
    await expect(verifyPasswordResetToken(token)).resolves.toBe('u-1')
  })

  it('rechaza tokens firmados con otro secreto', async () => {
    const ajeno = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setAudience('password-reset')
      .setJti('jti-ajeno')
      .setExpirationTime('60m')
      .sign(new TextEncoder().encode('otro_secreto_completamente_distinto'))

    await expect(verifyPasswordResetToken(ajeno)).resolves.toBeNull()
  })

  it('rechaza tokens con otra audience', async () => {
    const otroAud = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setAudience('ticket-public')
      .setJti('jti-x')
      .setExpirationTime('60m')
      .sign(new TextEncoder().encode(JWT_SECRET))

    await expect(verifyPasswordResetToken(otroAud)).resolves.toBeNull()
  })

  it('token basura o vacío devuelve null sin lanzar', async () => {
    await expect(verifyPasswordResetToken('no-es-un-jwt')).resolves.toBeNull()
    await expect(consumePasswordResetToken('')).resolves.toBeNull()
  })
})

describe('validateNewPassword', () => {
  it('exige al menos 8 caracteres', () => {
    expect(validateNewPassword('')).toMatch(/8 caracteres/)
    expect(validateNewPassword('abc123')).toMatch(/8 caracteres/)
  })

  it('acepta contraseñas de 8 o más caracteres', () => {
    expect(validateNewPassword('abcdefgh')).toBeNull()
    expect(validateNewPassword('contraseña-larga-123')).toBeNull()
  })
})

describe('passwordResetUrl', () => {
  it('apunta a /recuperar/<token>', async () => {
    const url = passwordResetUrl('http://localhost:3000/login', 'TOKEN-123')
    expect(url.endsWith('/recuperar/TOKEN-123')).toBe(true)
  })
})

describe('POST /api/auth/forgot', () => {
  it('si el correo existe, crea el enlace y encola el email', async () => {
    usuario.findUnique.mockResolvedValue({
      id: 'u-1', nombre: 'Ana', apellido: 'García', correo: 'ana@x.com', activo: true,
    })

    const res = await forgotPOST(forgotRequest('ana@x.com'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(enqueueEmail).toHaveBeenCalledTimes(1)
    const msg = enqueueEmail.mock.calls[0][0] as { to: string; subject: string; html: string }
    expect(msg.to).toBe('ana@x.com')
    expect(msg.subject).toMatch(/contraseña/i)
    expect(msg.html).toContain('/recuperar/')
    expect(msg.html).toContain('Ana García')
  })

  it('si el correo no existe responde igual y no envía nada (no enumera usuarios)', async () => {
    usuario.findUnique.mockResolvedValue(null)

    const ok = await forgotPOST(forgotRequest('no-existe@x.com'))
    const fail = await forgotPOST(forgotRequest('otro@x.com'))
    const data = await ok.json()

    expect(ok.status).toBe(200)
    expect(fail.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(enqueueEmail).not.toHaveBeenCalled()
  })

  it('rechaza el envío sin correo', async () => {
    const res = await forgotPOST(forgotRequest(''))
    expect(res.status).toBe(400)
    expect(enqueueEmail).not.toHaveBeenCalled()
  })

  it('no envía enlace a usuarios inactivos', async () => {
    usuario.findUnique.mockResolvedValue({
      id: 'u-2', nombre: 'Baja', apellido: '', correo: 'baja@x.com', activo: false,
    })

    const res = await forgotPOST(forgotRequest('baja@x.com'))
    expect(res.status).toBe(200)
    expect(enqueueEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset', () => {
  it('cambia la contraseña y consume el enlace', async () => {
    const token = await createPasswordResetToken('u-1')
    usuario.update.mockResolvedValue({ id: 'u-1' })

    const res = await resetPOST(resetRequest(token, 'nueva-clave-123'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(usuario.update).toHaveBeenCalledTimes(1)
    const updateArg = usuario.update.mock.calls[0][0] as {
      where: { id: string }
      data: { password: string }
    }
    expect(updateArg.where.id).toBe('u-1')

    const { compare } = await import('bcryptjs')
    expect(await compare('nueva-clave-123', updateArg.data.password)).toBe(true)

    // Uso único: el mismo enlace ya no sirve.
    const again = await resetPOST(resetRequest(token, 'otra-clave-999'))
    expect(again.status).toBe(400)
    expect(usuario.update).toHaveBeenCalledTimes(1)
  })

  it('contraseña corta: 400 sin consumir el enlace', async () => {
    const token = await createPasswordResetToken('u-1')

    const res = await resetPOST(resetRequest(token, 'corta'))
    expect(res.status).toBe(400)
    expect(usuario.update).not.toHaveBeenCalled()

    // El enlace sigue vigente para un intento válido.
    usuario.update.mockResolvedValue({ id: 'u-1' })
    const ok = await resetPOST(resetRequest(token, 'nueva-clave-123'))
    expect(ok.status).toBe(200)
  })

  it('token inválido: 400 con mensaje claro', async () => {
    const res = await resetPOST(resetRequest('token-basura', 'nueva-clave-123'))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/no es válido o ha expirado/)
    expect(usuario.update).not.toHaveBeenCalled()
  })

  it('sin token: 400', async () => {
    const res = await resetPOST(resetRequest('', 'nueva-clave-123'))
    expect(res.status).toBe(400)
  })
})

describe('resetPasswordEmail', () => {
  it('incluye el enlace, el nombre y el aviso de caducidad', () => {
    const { subject, html } = resetPasswordEmail('Ana García', 'https://apps/recuperar/TOK')

    expect(subject).toMatch(/contraseña/i)
    expect(html).toContain('https://apps/recuperar/TOK')
    expect(html).toContain('Ana García')
    expect(html).toContain('60 minutos')
    expect(html).toContain('caduca')
  })
})
