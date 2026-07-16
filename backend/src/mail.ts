import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getPrisma } from '../lib/prisma'
import { loadEmailConfig, type EmailConfig } from '../lib/email-config'
import { notifyUsers } from './socket'

let intervalHandle: ReturnType<typeof setInterval> | null = null

export async function checkMail(cfg?: EmailConfig) {
  const prisma = getPrisma()
  const config = cfg || (await loadEmailConfig())
  if (!config.enabled || !config.imapHost || !config.imapUser) return

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.imapUser, pass: config.imapPass },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.imapFolder)
    try {
      const result = await client.search({ seen: false })
      if (!result) return
      const msgs = result as number[]

      for (const seq of msgs) {
        try {
          const raw = await client.download(String(seq))
          const chunks: Buffer[] = []
          for await (const chunk of raw.content) {
            chunks.push(Buffer.from(chunk))
          }
          const parsed = await simpleParser(Buffer.concat(chunks))

          const fromEmail = parsed.from?.value?.[0]?.address
          if (!fromEmail) continue

          let usuario = await prisma.usuario.findUnique({ where: { correo: fromEmail } })
          if (!usuario) {
            const fromName = parsed.from?.value?.[0]?.name || fromEmail.split('@')[0]
            const defaultRole = await prisma.rol.findFirst({ where: { nombre: 'Usuario' } })
            usuario = await prisma.usuario.create({
              data: {
                nombre: fromName,
                apellido: '',
                correo: fromEmail,
                userName: fromEmail.split('@')[0] + '_' + Date.now(),
                password: null,
                rolId: defaultRole?.id || '',
                departamentoId: null,
              },
            })
          }

          const subject = parsed.subject || 'Sin asunto'
          const textBody = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, '') : '')

          const lastTicket = await prisma.ticket.findFirst({ orderBy: { codigo: 'desc' } })
          const nextNum = lastTicket ? parseInt(lastTicket.codigo.replace('TK-', ''), 10) + 1 : 1
          const codigo = `TK-${String(nextNum).padStart(5, '0')}`
          const catId = config.defaultCategoriaId || ''

          const ticket = await prisma.ticket.create({
            data: {
              codigo,
              asunto: subject.substring(0, 200),
              descripcion: textBody.substring(0, 2000),
              estado: 'NUEVO',
              nivelPrioridad: 'MEDIA',
              solicitanteId: usuario.id,
              categoriaId: catId,
              origen: 'CORREO',
            },
          })

          await prisma.logTicket.create({
            data: {
              ticketId: ticket.id,
              usuarioId: usuario.id,
              accion: 'CREACION',
              valorNuevo: 'Ticket creado desde correo',
            },
          })

          if (parsed.attachments?.length) {
            for (const att of parsed.attachments) {
              const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
              await prisma.adjunto.create({
                data: {
                  ticketId: ticket.id,
                  nombre: att.filename || 'sin_nombre',
                  tipo: att.contentType || 'application/octet-stream',
                  url: '',
                  data: buf.toString('base64'),
                  tamaño: buf.length,
                },
              })
            }
          }

          await client.messageFlagsAdd(seq, ['\\Seen'])

          console.log(`[Mail] Ticket ${codigo} creado desde correo de ${fromEmail}`)

          // Notificar a los agentes
          const agentes = await prisma.usuario.findMany({
            where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
            select: { id: true },
          })
          notifyUsers(
            agentes.map(a => a.id),
            'nuevoTicket',
            { ticket: { id: ticket.id, codigo, asunto: ticket.asunto } }
          )
        } catch (err) {
          console.error('[Mail] Error procesando correo:', err)
        }
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    console.error('[Mail] Error de conexión IMAP:', err)
  } finally {
    await client.logout()
  }
}

export function startMailListener(cfg?: EmailConfig) {
  stopMailListener()

  if (cfg) {
    if (cfg.enabled) {
      checkMail(cfg)
      intervalHandle = setInterval(() => checkMail(cfg), (cfg.checkInterval || 10) * 1000)
      console.log('[Mail] Listener iniciado con intervalo de', cfg.checkInterval || 10, 'segundos')
    }
    return
  }

  loadEmailConfig().then((c) => {
    if (c.enabled) {
      checkMail(c)
      intervalHandle = setInterval(() => checkMail(c), (c.checkInterval || 10) * 1000)
      console.log('[Mail] Listener iniciado con intervalo de', c.checkInterval || 10, 'segundos')
    }
  })
}

export function stopMailListener() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[Mail] Listener detenido')
  }
}
