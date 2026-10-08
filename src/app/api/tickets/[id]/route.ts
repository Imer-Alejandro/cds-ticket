import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { createNotification, emitTicketUpdate } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData } from '@/lib/mail/notify-email'
import { threadHeadersFromTicket } from '@/lib/mail/comment-email'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, correo: true } },
        agente: { select: { id: true, nombre: true, apellido: true } },
        equipo: { select: { id: true, nombre: true } },
        supervisor: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
        cola: { select: { id: true, nombre: true, equipo: { select: { nombre: true } } } },
        sla: true,
        comentarios: {
          orderBy: { fecha: 'asc' },
          include: {
            usuario: { select: { id: true, nombre: true, apellido: true } },
            adjuntos: true,
          },
        },
        adjuntos: { where: { comentarioId: null } },
        logs: { orderBy: { fecha: 'asc' }, include: { usuario: { select: { nombre: true, apellido: true } } } },
        etiquetas: { include: { etiqueta: true } },
      },
    })

    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    // Scope check: requester only sees own tickets; agents see assigned; admins see all
    const puedeVerTodo = hasPermission(session, 'tickets.viewAll')
    const puedeVerAsignados = hasPermission(session, 'tickets.viewAssigned')
    const puedeVerPropios = hasPermission(session, 'tickets.viewOwn')
    const esSolicitante = ticket.solicitanteId === (session.id as string)
    const esAgenteAsignado = ticket.agenteId === (session.id as string)

    const tieneAcceso =
      puedeVerTodo ||
      esAgenteAsignado ||
      (puedeVerPropios && esSolicitante) ||
      (puedeVerAsignados && esSolicitante)

    if (!tieneAcceso) {
      return NextResponse.json({ error: 'No tienes acceso a este ticket' }, { status: 403 })
    }

    // Requesters must not see internal comments
    const puedeVerComentariosInternos = hasPermission(session, 'tickets.viewInternalComments')
    if (!puedeVerComentariosInternos) {
      ticket.comentarios = ticket.comentarios.filter((c) => !c.esInterno)
    }

    return NextResponse.json(ticket)
  } catch {
    return NextResponse.json({ error: 'Error al obtener ticket' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await request.json()
    const ticket = await prisma.ticket.findUnique({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const esMiembroEquipo = hasPermission(session, 'tickets.viewAssigned')
    const puedeEditar = hasPermission(session, 'tickets.edit')
    const puedeCambiarEstado = hasPermission(session, 'tickets.changeStatus')
    const puedeAsignar = hasPermission(session, 'tickets.assign')

    const updateData: any = {}
    const logs: { accion: string; valorAnterior?: string; valorNuevo?: string }[] = []

    if (data.estado && data.estado !== ticket.estado) {
      if (!puedeCambiarEstado) {
        return NextResponse.json({ error: 'No tienes permisos para cambiar el estado' }, { status: 403 })
      }
      updateData.estado = data.estado
      logs.push({ accion: 'CAMBIO_ESTADO', valorAnterior: ticket.estado, valorNuevo: data.estado })
      if (data.estado === 'RESUELTO') updateData.fechaResolucion = new Date()
      if (data.estado === 'CERRADO') updateData.fechaCierre = new Date()
      if (data.estado === 'PENDIENTE') updateData.fechaPendiente = new Date()
    }
    if (data.agenteId && data.agenteId !== ticket.agenteId) {
      if (!esMiembroEquipo || !puedeAsignar) {
        return NextResponse.json({ error: 'No tienes permisos para reasignar tickets' }, { status: 403 })
      }
      updateData.agenteId = data.agenteId
      const agenteNuevo = await prisma.usuario.findUnique({
        where: { id: data.agenteId },
        select: { nombre: true, apellido: true },
      })
      const nombreNuevo = agenteNuevo ? `${agenteNuevo.nombre} ${agenteNuevo.apellido}`.trim() : data.agenteId
      let nombreAnterior = 'Sin asignar'
      if (ticket.agenteId) {
        const agenteAnterior = await prisma.usuario.findUnique({
          where: { id: ticket.agenteId },
          select: { nombre: true, apellido: true },
        })
        if (agenteAnterior) nombreAnterior = `${agenteAnterior.nombre} ${agenteAnterior.apellido}`.trim()
      }
      logs.push({ accion: 'ASIGNACION', valorAnterior: nombreAnterior, valorNuevo: `${nombreNuevo} (${data.agenteId})` })
    }
    if (data.equipoId !== undefined && data.equipoId !== ticket.equipoId) {
      if (!puedeAsignar) {
        return NextResponse.json({ error: 'No tienes permisos para asignar equipo' }, { status: 403 })
      }
      const equipoNuevo = data.equipoId ? await prisma.equipo.findUnique({ where: { id: data.equipoId }, select: { id: true, nombre: true, supervisorId: true } }) : null
      if (data.equipoId && !equipoNuevo) {
        return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
      }
      updateData.equipoId = equipoNuevo?.id ?? null
      let nombreAnterior = 'Sin equipo'
      if (ticket.equipoId) {
        const eqAnterior = await prisma.equipo.findUnique({ where: { id: ticket.equipoId }, select: { nombre: true } })
        if (eqAnterior) nombreAnterior = eqAnterior.nombre
      }
      logs.push({
        accion: 'ASIGNACION_EQUIPO',
        valorAnterior: nombreAnterior,
        valorNuevo: equipoNuevo?.nombre || 'Sin equipo',
      })
      // Al cambiar de equipo, el supervisor por defecto es el del equipo
      const nuevoSupervisorId = equipoNuevo?.supervisorId ?? null
      if (nuevoSupervisorId !== ticket.supervisorId) {
        updateData.supervisorId = nuevoSupervisorId
        const supNuevo = nuevoSupervisorId
          ? await prisma.usuario.findUnique({ where: { id: nuevoSupervisorId }, select: { nombre: true, apellido: true } })
          : null
        let nombreSupervisorAnterior = 'Sin supervisor'
        if (ticket.supervisorId) {
          const supAnterior = await prisma.usuario.findUnique({ where: { id: ticket.supervisorId }, select: { nombre: true, apellido: true } })
          if (supAnterior) nombreSupervisorAnterior = `${supAnterior.nombre} ${supAnterior.apellido}`.trim()
        }
        logs.push({
          accion: 'ASIGNACION_SUPERVISOR',
          valorAnterior: nombreSupervisorAnterior,
          valorNuevo: supNuevo ? `${supNuevo.nombre} ${supNuevo.apellido}`.trim() : 'Sin supervisor',
        })
      }
    }
    if (data.supervisorId !== undefined && data.supervisorId !== ticket.supervisorId) {
      if (!puedeAsignar) {
        return NextResponse.json({ error: 'No tienes permisos para asignar supervisor' }, { status: 403 })
      }
      const supNuevo = data.supervisorId ? await prisma.usuario.findUnique({ where: { id: data.supervisorId }, select: { id: true, nombre: true, apellido: true } }) : null
      if (data.supervisorId && !supNuevo) {
        return NextResponse.json({ error: 'Supervisor no encontrado' }, { status: 404 })
      }
      updateData.supervisorId = supNuevo?.id ?? null
      let nombreAnterior = 'Sin supervisor'
      if (ticket.supervisorId) {
        const supAnterior = await prisma.usuario.findUnique({ where: { id: ticket.supervisorId }, select: { nombre: true, apellido: true } })
        if (supAnterior) nombreAnterior = `${supAnterior.nombre} ${supAnterior.apellido}`.trim()
      }
      logs.push({
        accion: 'ASIGNACION_SUPERVISOR',
        valorAnterior: nombreAnterior,
        valorNuevo: supNuevo ? `${supNuevo.nombre} ${supNuevo.apellido}`.trim() : 'Sin supervisor',
      })
    }
    if (data.nivelPrioridad && data.nivelPrioridad !== ticket.nivelPrioridad) {
      if (!puedeCambiarEstado) {
        return NextResponse.json({ error: 'No tienes permisos para cambiar la prioridad' }, { status: 403 })
      }
      updateData.nivelPrioridad = data.nivelPrioridad
      logs.push({ accion: 'CAMBIO_PRIORIDAD', valorAnterior: ticket.nivelPrioridad, valorNuevo: data.nivelPrioridad })
    }
    if (data.asunto && data.asunto !== ticket.asunto) {
      if (!puedeEditar && !esMiembroEquipo && session.id !== ticket.solicitanteId) {
        return NextResponse.json({ error: 'No tienes permisos para editar este ticket' }, { status: 403 })
      }
      updateData.asunto = String(data.asunto).slice(0, 200)
      logs.push({ accion: 'CAMBIO_ASUNTO', valorAnterior: ticket.asunto, valorNuevo: updateData.asunto })
    }
    if (data.descripcion && data.descripcion !== ticket.descripcion) {
      if (!puedeEditar && !esMiembroEquipo && session.id !== ticket.solicitanteId) {
        return NextResponse.json({ error: 'No tienes permisos para editar este ticket' }, { status: 403 })
      }
      updateData.descripcion = String(data.descripcion)
      logs.push({ accion: 'CAMBIO_DESCRIPCION', valorAnterior: ticket.descripcion, valorNuevo: updateData.descripcion })
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true } },
        agente: { select: { id: true, nombre: true, apellido: true } },
        equipo: { select: { id: true, nombre: true } },
        supervisor: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    })

    for (const log of logs) {
      await prisma.logTicket.create({
        data: {
          ticketId: id,
          usuarioId: session.id as string,
          accion: log.accion,
          valorAnterior: log.valorAnterior,
          valorNuevo: log.valorNuevo,
        },
      })
    }

    if (data.estado) {
      await createNotification(ticket.solicitanteId, 'CAMBIO_ESTADO', `Ticket ${ticket.codigo} cambió a ${data.estado.replace(/_/g, ' ')}`, id)
    }
    if (data.agenteId && data.agenteId !== ticket.agenteId) {
      await createNotification(data.agenteId, 'ASIGNACION', `Has sido asignado al ticket ${ticket.codigo}: ${ticket.asunto}`, id)
    }
    if (data.supervisorId !== undefined && data.supervisorId && data.supervisorId !== ticket.supervisorId) {
      await createNotification(data.supervisorId, 'ASIGNACION', `Ticket ${ticket.codigo}: ${ticket.asunto} asignado bajo tu supervisión`, id)
    }

    // Emails: asignación al nuevo agente y cambio de estado al solicitante
    try {
      const mailData = toTicketEmailData({
        codigo: ticket.codigo,
        asunto: ticket.asunto,
        estado: updated.estado,
        nivelPrioridad: updated.nivelPrioridad,
        descripcion: ticket.descripcion,
      })
      const thread = threadHeadersFromTicket(ticket)

      if (data.agenteId && data.agenteId !== ticket.agenteId) {
        const agente = await prisma.usuario.findUnique({ where: { id: data.agenteId } })
        if (agente?.correo) {
          notifyByEmail({
            type: 'TICKET_ASIGNADO',
            to: agente.correo,
            agenteNombre: `${agente.nombre} ${agente.apellido}`.trim(),
            data: mailData,
            ...thread,
          })
        }
      }

      if (data.estado) {
        const solicitante = await prisma.usuario.findUnique({ where: { id: ticket.solicitanteId } })
        if (solicitante?.correo) {
          notifyByEmail({
            type: 'ESTADO_CAMBIADO',
            to: solicitante.correo,
            nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
            data: mailData,
            estadoLabel: data.estado.replace(/_/g, ' '),
            ...thread,
          })
        }
      }
    } catch {
      // el email nunca debe romper la actualización del ticket
    }

    await emitTicketUpdate(updated, data.estado ? 'estado' : (data.agenteId ? 'asignacion' : 'update'), session.id as string)

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar ticket' }, { status: 500 })
  }
}
