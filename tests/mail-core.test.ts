import { describe, it, expect } from 'vitest'
import {
  extractTicketCode,
  isReplyEmail,
  stripTicketCode,
  nextTicketCode,
  emailBodyToText,
  normalizeFromAddress,
  slaStatus,
} from '../src/lib/mail/core'

describe('extractTicketCode', () => {
  it('extrae el código TK-##### del asunto', () => {
    expect(extractTicketCode('Re: Impresora no funciona [TK-00012]')).toBe('TK-00012')
  })

  it('extrae el código sin prefijo RE', () => {
    expect(extractTicketCode('TK-00003 problema de red')).toBe('TK-00003')
  })

  it('devuelve null si no hay código', () => {
    expect(extractTicketCode('Hola, necesito ayuda')).toBeNull()
    expect(extractTicketCode(null)).toBeNull()
    expect(extractTicketCode(undefined)).toBeNull()
  })
})

describe('isReplyEmail', () => {
  it('detecta respuestas por código en el asunto', () => {
    expect(isReplyEmail('RE: algo [TK-00005]')).toBe(true)
  })

  it('detecta correos nuevos (sin código)', () => {
    expect(isReplyEmail('Nueva solicitud')).toBe(false)
  })
})

describe('stripTicketCode', () => {
  it('quita el código y espacios extra', () => {
    expect(stripTicketCode('Re: Impresora [TK-00012] rota')).toBe('Re: Impresora rota')
  })
})

describe('nextTicketCode', () => {
  it('genera el siguiente código secuencial', () => {
    expect(nextTicketCode(['TK-00001', 'TK-00005', 'TK-00003'])).toBe('TK-00006')
  })

  it('empieza en TK-00001 si no hay códigos', () => {
    expect(nextTicketCode([])).toBe('TK-00001')
  })

  it('tolera códigos TK consecutivos sin romper', () => {
    expect(nextTicketCode(['TK-00002', 'TK-00001', 'TK-00003'])).toBe('TK-00004')
  })

  it('ignora valores sin número', () => {
    expect(nextTicketCode(['TK-00005', 'basura'])).toBe('TK-00006')
  })
})

describe('emailBodyToText', () => {
  it('usa el texto plano si existe', () => {
    expect(emailBodyToText({ text: 'Hola mundo', html: '<b>Hola</b>' } as any)).toBe('Hola mundo')
  })

  it('convierte HTML a texto cuando no hay texto plano', () => {
    const html = '<p>Hola <b>mundo</b> &amp; amigos</p>'
    expect(emailBodyToText({ text: '', html } as any)).toBe('Hola mundo & amigos')
  })

  it('trunca a maxLength', () => {
    const long = 'x'.repeat(5000)
    expect(emailBodyToText({ text: long } as any, 100).length).toBe(100)
  })

  it('devuelve fallback si está vacío', () => {
    expect(emailBodyToText(null)).toBe('(Correo vacío)')
    expect(emailBodyToText({ text: '', html: '' } as any)).toBe('(Correo vacío)')
  })
})

describe('normalizeFromAddress', () => {
  it('extrae de from.value[0].address', () => {
    expect(normalizeFromAddress({ value: [{ address: 'User@Example.COM' }] })).toBe('user@example.com')
  })

  it('extrae de from.address', () => {
    expect(normalizeFromAddress({ address: 'otro@correo.cl' })).toBe('otro@correo.cl')
  })

  it('extrae de from.text con formato Nombre <email>', () => {
    expect(normalizeFromAddress({ text: 'Juan <juan@mail.com>' })).toBe('juan@mail.com')
  })

  it('devuelve null si no hay dirección', () => {
    expect(normalizeFromAddress(null)).toBeNull()
    expect(normalizeFromAddress({})).toBeNull()
  })
})

describe('slaStatus', () => {
  const base = { minutesResponse: 60, minutesResolution: 480 }

  it('marca breached en respuesta si se excede el límite', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T12:00:00Z')
    const status = slaStatus({ createdAt, minutesResponse: 60, minutesResolution: 480, now })
    expect(status.responseStatus).toBe('breached')
  })

  it('marca ok si respondió dentro del límite', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z')
    const firstResponseAt = new Date('2024-01-01T10:30:00Z')
    const status = slaStatus({ createdAt, firstResponseAt, minutesResponse: 60, minutesResolution: 480 })
    expect(status.responseStatus).toBe('ok')
  })

  it('marca warning cerca del límite', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T10:50:00Z')
    const status = slaStatus({ createdAt, minutesResponse: 60, minutesResolution: 480, now })
    expect(status.responseStatus).toBe('warning')
  })

  it('marca breached en resolución si se excede', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z')
    const resolvedAt = new Date('2024-01-01T22:00:00Z')
    const status = slaStatus({ createdAt, resolvedAt, minutesResponse: 60, minutesResolution: 480 })
    expect(status.resolutionStatus).toBe('breached')
  })
})
