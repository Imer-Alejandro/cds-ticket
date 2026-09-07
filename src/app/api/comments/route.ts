import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createNotification, emitTicketUpdate } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData } from '@/lib/mail/notify-email'

const MAX_ADJUNTOS = 10
const MAX_TAMAÑO_BYTES = 10 * 1024 * 1024

interface AdjuntoInput { nombre?: string; tipo?: string; url?: string; data?: string; tamaño?: number }

function validarAdjuntos(lista: AdjuntoInput[]): string | null {
  if (lista.length > MAX_ADJUNTOS) return `Máximo ${MAX_ADJUNTOS} adjuntos por comentario`
  const excedido = lista.find((a) => {
    const tam = typeof a.tamaño === 'number' ? a.tamaño : (typeof a.data === 'string' ? Math.ceil((a.data.length * 3) / 4) : 0)
    return tam > MAX_TAMAÑO_BYTES
  })
  if (excedido) return `Adjunto "${excedido.nombre || 'sin_nombre'}" supera el límite de 10 MB`
  return null
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.ticketId || !data.mensaje) {
      return NextResponse.json({ error: 'ticketId y mensaje son requeridos' }, { status: 400 })
    }

    const adjuntos = Array.isArray(data.adjuntos) ? (data.adjuntos as AdjuntoInput[]) : []
    const errorAdjuntos = validarAdjuntos(adjuntos)
    if (errorAdjuntos) return NextResponse.json({ error: errorAdjuntos }, { status: 400 })

    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      select: { id: true, codigo: true, solicitanteId: true, agenteId: true, estado: true, fechaPrimeraRespuesta: true },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const rolNombre = (session as { rolNombre?: string }).rolNombre
    const esMiembroEquipo = rolNombre === 'Agente' || rolNombre === 'Administrador'
    const esSolicitante = ticket.solicitanteId === session.id

    if (!esMiembroEquipo && !esSolicitante) {
      return NextResponse.json({ error: 'No tienes permiso para comentar en este ticket' }, { status: 403 })
    }

    const esInterno = esMiembroEquipo ? Boolean(data.esInterno) : false
    const nombreAutor = `${(session as { nombre?: string }).nombre || ''}`.trim() || (session.id as string)

    const comment = await prisma.comentario.create({
      data: {
        ticketId: data.ticketId,
        usuarioId: session.id as string,
        mensaje: data.mensaje,
        esInterno,
      },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
      },
    })

    if (adjuntos.length) {
      await prisma.adjunto.createMany({
        data: adjuntos.map((a) => ({
          ticketId: data.ticketId,
          comentarioId: comment.id,
          nombre: a.nombre || '',
          tipo: a.tipo || 'application/octet-stream',
          url: a.url || '',
          data: a.data,
          tamaño: a.tamaño,
        })),
      })
    }

    const esPrimeraRespuesta = esMiembroEquipo && !data.esInterno && !ticket.fechaPrimeraRespuesta
    if (esMiembroEquipo && (ticket.agenteId !== (session.id as string) || esPrimeraRespuesta)) {
      const updateData: { agenteId?: string; estado?: string; fechaPrimeraRespuesta?: Date } = {}
      if (ticket.agenteId !== (session.id as string)) {
        updateData.agenteId = session.id as string
        if (ticket.estado === 'NUEVO') updateData.estado = 'ASIGNADO'
      }
      if (esPrimeraRespuesta) updateData.fechaPrimeraRespuesta = new Date()

      await prisma.ticket.update({
        where: { id: data.ticketId },
        data: updateData,
      })

      if (ticket.agenteId !== (session.id as string)) {
        let nombreAnterior = 'Sin asignar'
        if (ticket.agenteId) {
          const anterior = await prisma.usuario.findUnique({
            where: { id: ticket.agenteId },
            select: { nombre: true, apellido: true },
          })
          if (anterior) nombreAnterior = `${anterior.nombre} ${anterior.apellido}`.trim()
        }
        await prisma.logTicket.create({
          data: {
            ticketId: data.ticketId,
            usuarioId: session.id as string,
            accion: 'ASIGNACION',
            valorAnterior: nombreAnterior,
            valorNuevo: `${nombreAutor} (${session.id as string})`,
          },
        })
      }
    }

    if (!data.esInterno) {
      if (ticket.solicitanteId !== session.id) {
        await createNotification(ticket.solicitanteId, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo}`, ticket.id)
      }
      if (ticket.agenteId && ticket.agenteId !== session.id) {
        await createNotification(ticket.agenteId, 'NUEVO_COMENTARIO', `Nuevo comentario en ${ticket.codigo}`, ticket.id)
      }
    }

    // Emails de notificación de comentario (nunca para comentarios internos)
    if (!data.esInterno) {
      try {
        const mailData = await prisma.ticket.findUnique({
          where: { id: ticket.id },
          select: { codigo: true, asunto: true, estado: true, nivelPrioridad: true, descripcion: true },
        })
        const emailData = mailData ? toTicketEmailData(mailData) : toTicketEmailData({
          codigo: ticket.codigo,
          asunto: 'Ticket',
          estado: ticket.estado,
          nivelPrioridad: 'MEDIA',
          descripcion: '',
        })

        if (ticket.solicitanteId !== session.id) {
          const solicitante = await prisma.usuario.findUnique({ where: { id: ticket.solicitanteId } })
          if (solicitante?.correo) {
            notifyByEmail({
              type: 'NUEVO_COMENTARIO',
              to: solicitante.correo,
              nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
              data: emailData,
              comentario: data.mensaje,
            })
          }
        }
        if (ticket.agenteId && ticket.agenteId !== session.id) {
          const agente = await prisma.usuario.findUnique({ where: { id: ticket.agenteId } })
          if (agente?.correo) {
            notifyByEmail({
              type: 'NUEVO_COMENTARIO',
              to: agente.correo,
              nombre: `${agente.nombre} ${agente.apellido}`.trim(),
              data: emailData,
              comentario: data.mensaje,
            })
          }
        }
      } catch {
        // el email no debe romper el comentario
      }
    }

    await emitTicketUpdate(
      {
        id: ticket.id,
        codigo: ticket.codigo,
        asunto: data.mensaje,
      },
      'comentario',
      session.id as string,
    )

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 })
  }
}
