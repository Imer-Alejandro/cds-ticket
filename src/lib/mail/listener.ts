import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import prisma from '@/lib/prisma'
import { loadEmailConfig } from './config'
import { resolveEmailCategoriaId, resolveEmailRoleId } from './helpers'
import { handleIncomingEmail } from './ingest'
import { createNotification } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData } from './notify-email'
import { emitTicketUpdate } from '@/lib/notifications'
import { autoAssignAgent } from '@/lib/assignment'
import { makePrismaAssignmentRepo } from '@/lib/assignment-prisma'

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
      auth: { user: config.imapUser, pass: config.imapPass },
      logger: false,
    })

    await client.connect()
    const mailbox = await client.mailboxOpen(config.imapFolder)
    console.log(`Mailbox opened: ${config.imapFolder}, messages: ${mailbox.exists}`)

    const searchResult = await client.search({ seen: false })
    const messages: number[] = searchResult || []
    const fallbackMessages: number[] = !messages.length ? ((await client.search({ seen: false })) || []) : []
    const finalMessages = messages.length ? messages : fallbackMessages

    if (finalMessages.length === 0) {
      console.log('No unread messages found')
      await client.logout()
      return
    }

    for (let i = Math.max(0, finalMessages.length - 20); i < finalMessages.length; i++) {
      const message = finalMessages[i]
      try {
        const msg = await client.fetchOne(message, { source: true })
        if (msg && 'source' in msg && msg.source) {
          const parsed = await simpleParser(msg.source)
          await processIncomingEmail(parsed)
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
      } catch {
        // ignorar
      }
    }
  }
}

/**
 * Procesa un correo ya parseado: decide entre ticket nuevo o respuesta,
 * crea/vincula el ticket y dispara notificaciones en app + email.
 * Exportado para ser reutilizado por el backend (unificación)
 * y para tests de integración.
 */
export async function processIncomingEmail(parsed: any) {
  const config = await loadEmailConfig()
  const defaultCategoriaId = await resolveEmailCategoriaId({ defaultCategoriaId: config.defaultCategoriaId } as any, prisma) ?? undefined

  const result = await handleIncomingEmail(
    {
      repo: prisma as any,
      defaultCategoriaId,
      resolveRoleId: () => resolveEmailRoleId(prisma),
      autoAssign: async ({ colaId }) => autoAssignAgent(makePrismaAssignmentRepo(prisma), colaId),
      log: console.log,
    },
    parsed
  )

  if (!result) return null

  const ticket = await prisma.ticket.findUnique({
    where: { id: result.ticketId },
    include: {
      solicitante: { select: { id: true, nombre: true, apellido: true, correo: true } },
      agente: { select: { id: true, nombre: true, correo: true } },
    },
  })
  if (!ticket) return result

  if (result.kind === 'new') {
    // Notificar a agentes en la app
    const agentes = await prisma.usuario.findMany({
      where: { rol: { nombre: { in: ['Agente', 'Administrador'] } } },
      select: { id: true },
    })
    for (const agente of agentes) {
      await createNotification(agente.id, 'NUEVO_TICKET', `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`, ticket.id)
    }
    // Email de acuse al solicitante
    notifyByEmail({
      type: 'TICKET_CREADO',
      to: ticket.solicitante.correo,
      nombre: `${ticket.solicitante.nombre}`,
      data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
    })
    void emitTicketUpdate({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'nuevo', 'email')
  } else {
    // Respuesta: notificar al agente asignado (in-app + email)
    if (ticket.agente) {
      await createNotification(ticket.agente.id, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo} (por correo)`, ticket.id)
      notifyByEmail({
        type: 'NUEVO_COMENTARIO',
        to: ticket.agente.correo,
        nombre: ticket.agente.nombre,
        data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
        comentario: 'El solicitante respondió por correo.',
      })
    }
    void emitTicketUpdate({ id: ticket.id, codigo: ticket.codigo, asunto: ticket.asunto }, 'comentario', 'email')
  }

  return result
}

export function startMailListener() {
  void processIncomingEmails()
}

/** Compatibilidad: envía una respuesta por correo al solicitante del ticket. */
export async function sendEmailReply(ticketId: string, message: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { solicitante: { select: { nombre: true, correo: true } } },
  })
  if (!ticket) throw new Error('Ticket not found')

  notifyByEmail({
    type: 'NUEVO_COMENTARIO',
    to: ticket.solicitante.correo,
    nombre: ticket.solicitante.nombre,
    data: toTicketEmailData({ ...ticket, descripcion: ticket.descripcion }),
    comentario: message,
  })
  return true
}