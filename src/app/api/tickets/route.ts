import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notifyAgentes, createNotification } from '@/lib/notifications'
import { notifyByEmail, toTicketEmailData } from '@/lib/mail/notify-email'
import { nextTicketCode } from '@/lib/mail/core'
import { autoAssignAgent } from '@/lib/assignment'
import { makePrismaAssignmentRepo } from '@/lib/assignment-prisma'
import { esPrioridadTicket, PRIORIDADES_TICKET, ORIGENES_TICKET } from '@/lib/tickets'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const estado = searchParams.get('estado') || ''
    const prioridad = searchParams.get('prioridad') || ''
    const categoriaId = searchParams.get('categoriaId') || ''
    const agenteId = searchParams.get('agenteId') || ''
    const sinAsignar = searchParams.get('sinAsignar') === 'true'
    const asignadosA = searchParams.get('asignadosA') || ''
    const sortField = searchParams.get('sortField') || 'fechaCreacion'
    const sortDir = searchParams.get('sortDir') || 'desc'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 1), 100)

    const where: any = {}
    if (search) {
      where.OR = [
        { asunto: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { solicitante: { correo: { contains: search, mode: 'insensitive' } } },
        { agente: { nombre: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (estado) where.estado = estado
    if (prioridad) where.nivelPrioridad = prioridad
    if (categoriaId) where.categoriaId = categoriaId
    if (agenteId) where.agenteId = agenteId
    if (asignadosA) where.agenteId = asignadosA
    if (sinAsignar) where.agenteId = null

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          solicitante: { select: { id: true, nombre: true, apellido: true } },
          agente: { select: { id: true, nombre: true, apellido: true } },
          categoria: { select: { id: true, nombre: true } },
          sla: { select: { id: true, minutosRespuesta: true, minutosResolucion: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch {
    return NextResponse.json({ error: 'Error al obtener tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    if (!data.asunto || !data.descripcion || !data.categoriaId) {
      return NextResponse.json({ error: 'Asunto, descripción y categoría son requeridos' }, { status: 400 })
    }

    const nivelPrioridad = esPrioridadTicket(data.nivelPrioridad) ? data.nivelPrioridad : 'MEDIA'
    const origen = (ORIGENES_TICKET as readonly string[]).includes(data.origen) ? data.origen : 'WEB'

    const categoria = await prisma.categoria.findUnique({
      where: { id: data.categoriaId },
      include: { colaDefault: true },
    })
    if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

    const rolNombre = (session as { rolNombre?: string }).rolNombre
    const esMiembroEquipo = rolNombre === 'Agente' || rolNombre === 'Administrador'

    // Asignación: miembro del equipo se autoasigna (o usa el agente explícito);
    // el resto de solicitantes reciben asignación automática por carga de la cola.
    let agenteIdAsignado: string | null = null
    if (esMiembroEquipo) {
      agenteIdAsignado = data.agenteId || (session.id as string)
    } else {
      const asignado = await autoAssignAgent(makePrismaAssignmentRepo(prisma), categoria.colaDefaultId)
      agenteIdAsignado = asignado?.id ?? null
    }

    const lastTickets = await prisma.ticket.findMany({ orderBy: { codigo: 'desc' }, take: 10, select: { codigo: true } })
    const codigo = nextTicketCode(lastTickets.map(t => t.codigo))

    const sla = await prisma.sla.findFirst({
      where: { categoriaId: data.categoriaId, prioridad: nivelPrioridad },
    })

    const ticket = await prisma.ticket.create({
      data: {
        codigo,
        asunto: data.asunto,
        descripcion: data.descripcion,
        estado: agenteIdAsignado ? 'ASIGNADO' : 'NUEVO',
        nivelPrioridad,
        solicitanteId: data.solicitanteId || session.id as string,
        agenteId: agenteIdAsignado,
        categoriaId: data.categoriaId,
        colaId: categoria.colaDefaultId,
        slaId: sla?.id || null,
        origen,
      },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    })

    await prisma.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: ticket.solicitanteId,
        accion: 'CREACION',
        valorNuevo: 'Ticket creado',
      },
    })

    let agenteAsignado: { id: string; nombre: string; apellido: string; correo?: string | null } | null = null
    if (agenteIdAsignado) {
      agenteAsignado = await prisma.usuario.findUnique({
        where: { id: agenteIdAsignado },
        select: { id: true, nombre: true, apellido: true, correo: true },
      })
      const nombreAgente = agenteAsignado ? `${agenteAsignado.nombre} ${agenteAsignado.apellido}`.trim() : agenteIdAsignado
      await prisma.logTicket.create({
        data: {
          ticketId: ticket.id,
          usuarioId: session.id as string,
          accion: 'ASIGNACION',
          valorAnterior: 'Sin asignar',
          valorNuevo: `${nombreAgente} (${agenteIdAsignado})`,
        },
      })
      await createNotification(agenteIdAsignado, 'ASIGNACION', `Has sido asignado al ticket ${ticket.codigo}: ${ticket.asunto}`, ticket.id)
    }

    if (data.adjuntos && Array.isArray(data.adjuntos)) {
      await prisma.adjunto.createMany({
        data: data.adjuntos.map((a: any) => ({
          ticketId: ticket.id,
          nombre: a.nombre,
          tipo: a.tipo,
          url: a.url || '',
          data: a.data,
          tamaño: a.tamaño,
        })),
      })
    }

    const mailData = toTicketEmailData({
      codigo: ticket.codigo,
      asunto: ticket.asunto,
      estado: ticket.estado,
      nivelPrioridad: ticket.nivelPrioridad,
      descripcion: ticket.descripcion,
    })

    // Email de acuse al solicitante (si es distinto de quien asigna y no es correo)
    try {
      const solicitante = await prisma.usuario.findUnique({ where: { id: ticket.solicitanteId } })
      if (solicitante?.correo) {
        notifyByEmail({
          type: 'TICKET_CREADO',
          to: solicitante.correo,
          nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
          data: mailData,
        })
      }
    } catch {
      // no romper la creación
    }

    // Email de asignación al agente asignado
    if (agenteAsignado?.correo) {
      try {
        notifyByEmail({
          type: 'TICKET_ASIGNADO',
          to: agenteAsignado.correo,
          agenteNombre: `${agenteAsignado.nombre} ${agenteAsignado.apellido}`.trim(),
          data: mailData,
        })
      } catch {
        // no romper la creación
      }
    }

    await notifyAgentes(ticket.id, 'NUEVO_TICKET', `Nuevo ticket ${ticket.codigo}: ${ticket.asunto}`)

    return NextResponse.json(ticket, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 })
  }
}
