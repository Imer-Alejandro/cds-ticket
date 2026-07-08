import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import prisma from '@/lib/prisma'
import { loadEmailConfig } from './config'
import nodemailer from 'nodemailer'

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

    // Buscar correos sin leer
    let messages = await client.search({ unseen: true })

    if (messages.length === 0) {
      console.log('No unread messages found')
      await client.logout()
      return
    }

    // Procesar últimos 10 correos
    for (let i = Math.max(0, messages.length - 10); i < messages.length; i++) {
      const message = messages[i]
      try {
        // Obtener el mensaje completo
        let msg = await client.fetchOne(message, { source: true })
        
        if (msg.source) {
          // Parsear el correo
          const parsed = await simpleParser(msg.source)
          
          // Crear ticket desde el correo
          await createTicketFromEmail(parsed, config.defaultCategoriaId)
          
          // Marcar como leído
          await client.setFlags(message, ['\\Seen'])
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
    
    // Obtener o crear usuario desde el correo del remitente
    let solicitante = await prisma.usuario.findUnique({
      where: { correo: fromEmail },
    })

    if (!solicitante) {
      // Crear usuario automáticamente
      const emailParts = fromEmail.split('@')[0]
      const nameParts = emailParts.split(/[._-]/)
      const nombre = nameParts[0] || 'Usuario'
      const apellido = nameParts[1] || 'Externo'
      
      // Buscar rol por defecto
      const rolDefecto = await prisma.rol.findFirst()
      
      if (!rolDefecto) {
        console.error('No default role found')
        return
      }

      solicitante = await prisma.usuario.create({
        data: {
          correo: fromEmail,
          nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
          apellido: apellido.charAt(0).toUpperCase() + apellido.slice(1),
          userName: fromEmail.split('@')[0],
          rolId: rolDefecto.id,
        },
      })
      console.log(`Created new user from email: ${fromEmail}`)
    }

    // Obtener categoría por defecto
    let categoriaId = defaultCategoryId
    if (!categoriaId) {
      const categoria = await prisma.categoria.findFirst()
      if (!categoria) {
        console.error('No default category found')
        return
      }
      categoriaId = categoria.id
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

    console.log(`Created ticket ${codigo} from email: ${fromEmail}`)
    return ticket
  } catch (error) {
    console.error('Error creating ticket from email:', error)
    throw error
  }
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
