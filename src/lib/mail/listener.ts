import { ImapFlow, type FetchMessageObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import prisma from '@/lib/prisma'
import { loadEmailConfig } from './config'
import nodemailer from 'nodemailer'
import { resolveEmailCategoriaId } from './helpers'
import { createNotification } from '@/lib/notifications'

export interface ParsedEmail {
  from: string
  to: string
  subject: string
  text: string
  html: string
}

export async function processIncomingEmails() {
  let client: ImapFlow | null = null
  try {
    const config = await loadEmailConfig()
    
    if (!config.enabled) {
      console.log('Email processing is disabled')
      return
    }

    if (!config.imapHost || !config.imapUser || !config.imapPass) {
      console.error('IMAP configuration incomplete')
      return
    }

    client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: {
        user: config.imapUser,
        pass: config.imapPass,
      },
    })

    // Conectar al servidor IMAP
    await client.connect()

    // Abrir mailbox
    let mailbox = await client.mailboxOpen(config.imapFolder)
    console.log(`Mailbox opened: ${config.imapFolder}, messages: ${mailbox.exists}`)

    // Buscar solo correos sin leer
    const searchResult = await client.search({ seen: false })
    const messages = Array.isArray(searchResult) ? searchResult : []

    if (messages.length === 0) {
      console.log('No unread messages found')
      await client.logout()
      return
    }

    // Procesar los correos sin leer de forma secuencial
    for (let i = Math.max(0, messages.length - 20); i < messages.length; i++) {
      const message = messages[i]
      try {
        // Obtener el mensaje completo
        const msg = await client.fetchOne(message, { source: true })
        
        if (msg && 'source' in msg && msg.source) {
          // Parsear el correo
          const parsed = await simpleParser(msg.source)
          
          // Crear ticket desde el correo
          await createTicketFromEmail(parsed, config.defaultCategoriaId)
          
          // Marcar como leído
          await client.messageFlagsAdd(message, ['\\Seen'])
        }
      } catch (error) {
        console.error(`Error processing message ${message}:`, error)
      }
    }

    await client.logout()
  } catch (error) {
    console.error('Error processing emails:', error)
  } finally {
    if (client) {
      try {
        await client.logout()
      } catch (e) {
        // Ignorar errores al cerrar conexión
      }
    }
  }
}

async function createTicketFromEmail(
  email: any,
  defaultCategoryId?: string
) {
  try {
    // Extraer email del remitente
    const fromEmail = email.from?.text || email.from?.address || 'desconocido@example.com'

    // Evitar crear usuarios por cada correo externo. Se reutiliza un usuario interno de soporte
    // para que los tickets queden asociados a un solicitante estable y no se llenen de cuentas.
    let solicitante = await prisma.usuario.findFirst({
      where: { correo: { equals: fromEmail, mode: 'insensitive' } },
    })

    if (!solicitante) {
      const fallbackUser = await prisma.usuario.findFirst({
        where: { correo: { contains: 'soporte', mode: 'insensitive' } },
      })

      if (!fallbackUser) {
        const fallbackRole = await prisma.rol.findFirst({ where: { nombre: 'Usuario' } })
        if (!fallbackRole) {
          console.error('No fallback user or role found for incoming email')
          return
        }

        solicitante = await prisma.usuario.create({
          data: {
            correo: `soporte+email@${fromEmail.split('@')[1] || 'local'}`,
            nombre: 'Soporte',
            apellido: 'Correo',
            userName: `soporte_email_${Date.now()}`,
            rolId: fallbackRole.id,
          },
        })
      } else {
        solicitante = fallbackUser
      }
    }

    // Obtener categoría por defecto
    let categoriaId = defaultCategoryId?.trim() || null
    if (!categoriaId) {
      categoriaId = await resolveEmailCategoriaId({ defaultCategoriaId: '' } as any, prisma)
    } else {
      categoriaId = await resolveEmailCategoriaId({ defaultCategoriaId: categoriaId } as any, prisma)
    }

    if (!categoriaId) {
      console.error('No default category found')
      return
    }

    // Crear ticket
    const codigo = `TKT-${Date.now()}`
    const ticket = await prisma.ticket.create({
      data: {
        codigo,
        asunto: email.subject || '(Sin asunto)',
        descripcion: email.text || email.html || '(Correo vacío)',
        estado: 'NUEVO',
        nivelPrioridad: 'MEDIA',
        solicitanteId: solicitante.id,
        categoriaId,
        origen: 'CORREO',
      },
    })

    await prisma.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: solicitante.id,
        accion: 'CREACION',
        valorNuevo: 'Ticket creado desde correo',
      },
    })

    // Notificar a agentes y usuarios relevantes
    const agentes = await prisma.usuario.findMany({
      where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
      select: { id: true },
    })

    for (const agente of agentes) {
      await createNotification(
        agente.id,
        'NUEVO_TICKET',
        `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`,
        ticket.id,
      )
    }

    console.log(`Created ticket ${codigo} from email: ${fromEmail}`)
    return ticket
  } catch (error) {
    console.error('Error creating ticket from email:', error)
    throw error
  }
}

export function startMailListener() {
  void processIncomingEmails()
}

export async function sendEmailReply(ticketId: string, message: string) {
  try {
    const config = await loadEmailConfig()
    
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      throw new Error('SMTP configuration incomplete')
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { solicitante: true },
    })

    if (!ticket) throw new Error('Ticket not found')

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    })

    await transporter.sendMail({
      from: `${config.fromName} <${config.fromAddress}>`,
      to: ticket.solicitante.correo,
      subject: `Re: ${ticket.asunto} [${ticket.codigo}]`,
      html: `
        <p>${message}</p>
        <hr style="margin: 20px 0" />
        <p style="color: #666; font-size: 12px;">
          <strong>Ticket:</strong> ${ticket.codigo}<br/>
          <strong>Estado:</strong> ${ticket.estado}<br/>
          <strong>Prioridad:</strong> ${ticket.nivelPrioridad}
        </p>
      `,
    })

    console.log(`Email sent to ${ticket.solicitante.correo} for ticket ${ticket.codigo}`)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}
