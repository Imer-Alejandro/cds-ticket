import prisma from '@/lib/prisma'
import { mergeThreadRefs, normalizeMessageId } from './core'

/**
 * Persiste el Message-ID de un correo saliente para encadenar el hilo del ticket.
 *
 * Solo el correo marcado como raíz (`root`, el acuse inicial) fija el ancla
 * (`messageId`) y el padre del siguiente mensaje (`ultimoMessageId`). Así el
 * ancla siempre es el primer correo que recibe el solicitante y los correos
 * dirigidos al agente no desplazan el hilo del cliente.
 */
export async function recordOutboundMessage(
  ticketId: string,
  internetMessageId: string,
  root = false,
): Promise<void> {
  const id = normalizeMessageId(internetMessageId)
  if (!ticketId || !id || !root) return
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { messageId: true, threadRefs: true },
    })
    if (!ticket) return

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        messageId: ticket.messageId ?? id,
        ultimoMessageId: id,
        threadRefs: mergeThreadRefs(ticket.threadRefs, id),
      },
    })
  } catch (err) {
    // Guardar el hilo no debe romper el envío del correo.
    console.error('[Mail] No se pudo guardar el Message-ID saliente del ticket:', err)
  }
}
