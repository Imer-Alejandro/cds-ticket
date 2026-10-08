import {
  extractTicketCode,
  isReplyEmail,
  nextTicketCode,
  emailBodyToText,
  normalizeFromAddress,
  cleanReplyText,
  normalizeMessageId,
  headerThreadIds,
  mergeThreadRefs,
} from './core'
import { etiquetaColor } from '../categorize'
import type { AgenteCandidato } from '@/lib/assignment'

export interface IncomingEmail {
  from?: any
  subject?: string | null
  text?: string | null
  html?: string | null
  inReplyTo?: string | null
  references?: string | string[] | null
  messageId?: string | null
  attachments?: { content: string | Buffer; contentType?: string; filename?: string }[]
  [key: string]: unknown
}

export interface ParsedDecision {
  kind: 'reply' | 'new'
  codigo?: string | null
  fromEmail?: string | null
}

/** Decide si un correo entrante es una respuesta a un ticket o una nueva solicitud. */
export function decideIncomingEmail(
  from: any,
  subject?: string | null,
  headers?: { inReplyTo?: string | null; references?: string | string[] | null; messageId?: string | null } | null
): ParsedDecision {
  const fromEmail = normalizeFromAddress(from)
  if (isReplyEmail(subject, headers)) {
    return { kind: 'reply', codigo: extractTicketCode(subject, headers), fromEmail }
  }
  return { kind: 'new', codigo: null, fromEmail }
}

/** Interface mínima de Prisma que el servicio necesita. Permite inyectar stubs en tests. */
export interface TicketRepo {
  ticket: {
    findFirst(args: any): Promise<any>
    findUnique(args: any): Promise<any>
    findMany(args: any): Promise<any>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
  }
  usuario: {
    findUnique(args: any): Promise<any>
    findFirst(args: any): Promise<any>
    create(args: any): Promise<any>
  }
  rol: { findFirst(args: any): Promise<any> }
  categoria: {
    findUnique(args: any): Promise<any>
    findFirst(args: any): Promise<any>
  }
  comentario: {
    create(args: any): Promise<any>
    findFirst?(args: { where: { messageId: { in: string[] } }; select: { ticketId: true } }): Promise<{ ticketId: string } | null>
  }
  /** Registro de Message-IDs ya ingeridos (deduplicación). Opcional para stubs. */
  correoProcesado?: {
    findUnique(args: { where: { messageId: string } }): Promise<{
      messageId: string
      ticketId?: string | null
      codigo?: string | null
      origen?: string | null
    } | null>
    create(args: { data: { messageId: string; ticketId: string; codigo: string; origen: string } }): Promise<unknown>
  }
  logTicket: { create(args: any): Promise<any> }
  adjunto: { createMany(args: any): Promise<any> }
  sla: { findFirst(args: any): Promise<any> }
  cola: { findFirst(args: any): Promise<any> }
  etiqueta?: {
    findFirst(args: any): Promise<any>
    create(args: any): Promise<any>
  }
  ticketEtiqueta?: {
    findFirst(args: any): Promise<any>
    create(args: any): Promise<any>
  }
}

export interface IngestResult {
  kind: 'reply' | 'new' | 'duplicate'
  ticketId: string
  codigo: string
  reply?: boolean
}

const MAX_ADJUNTOS = 10
const MAX_TAMAÑO_BYTES = 10 * 1024 * 1024

/** Filtra adjuntos que superan el límite de la aplicación (10 archivos, 10 MB). */
export function adjuntosValidos(attachments: IncomingEmail['attachments'] = []): NonNullable<IncomingEmail['attachments']> {
  return (attachments || []).slice(0, MAX_ADJUNTOS).filter((att) => {
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '')
    return buf.length <= MAX_TAMAÑO_BYTES
  })
}

export interface IngestDeps {
  repo: TicketRepo
  defaultCategoriaId?: string
  resolveRoleId?: () => Promise<string | null>
  /** Asignación automática por carga de la cola (si está configurada). */
  autoAssign?: (info: { colaId: string }) => Promise<AgenteCandidato | null>
  /** Resuelve el routing del ticket: categoría por keywords + equipo/supervisor de la cola. */
  resolverCategoria?: (info: {
    asunto?: string
    descripcion?: string
    manualCategoriaId?: string | null
    defaultCategoriaId?: string | null
  }) => Promise<{
    categoriaId: string
    categoriaNombre: string
    colaId: string | null
    equipo: { id: string; nombre: string } | null
    supervisor: { id: string; nombre: string; apellido: string } | null
    etiquetas: string[]
  }>
  /** Direcciones que envía el propio sistema: sus correos se ignoran (anti-loop). */
  systemFroms?: string[]
  log?: (msg: string) => void
}

/** Ticket mínimo que necesita el flujo de respuesta por correo. */
export interface TicketHilo {
  id: string
  codigo: string
  solicitanteId: string
  messageId?: string | null
  threadRefs?: string | null
  ultimoMessageId?: string | null
}

/**
 * Crea un comentario en el ticket original cuando llega una respuesta por correo.
 * Asigna automáticamente la etiqueta "Solicitante respondió", limpia la cita del
 * correo previo y actualiza el hilo de conversación del ticket (Message-IDs).
 */
async function replyToTicket(
  deps: IngestDeps,
  email: IncomingEmail,
  ticket: TicketHilo,
  headers: { inReplyTo?: string | null; references?: string | string[] | null; messageId?: string | null } | null
) {
  const { repo, log } = deps
  const codigo = ticket.codigo
  const incomingMessageId = normalizeMessageId(headers?.messageId)

  const fromEmail = normalizeFromAddress(email.from) || ''
  const rawBody = emailBodyToText(email as any, 5000)
  const cleanedBody = cleanReplyText(rawBody)

  const comment = await repo.comentario.create({
    data: {
      ticketId: ticket.id,
      usuarioId: ticket.solicitanteId,
      mensaje: cleanedBody || rawBody,
      esInterno: false,
      messageId: incomingMessageId,
    },
  })

  await repo.logTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: ticket.solicitanteId,
      accion: 'RESPUESTA_CORREO',
      valorNuevo: `Respuesta por correo de ${fromEmail}`,
    },
  })

  // Asignar etiqueta "Solicitante respondió" si el repositorio Prisma la soporta
  if (repo.etiqueta && repo.ticketEtiqueta) {
    try {
      let etiqueta = await repo.etiqueta.findFirst({ where: { nombre: 'Solicitante respondió' } })
      if (!etiqueta) {
        etiqueta = await repo.etiqueta.create({
          data: { nombre: 'Solicitante respondió', color: '#f59e0b' },
        })
      }
      if (etiqueta) {
        const yaEtiquetado = await repo.ticketEtiqueta.findFirst({
          where: { ticketId: ticket.id, etiquetaId: etiqueta.id },
        })
        if (!yaEtiquetado) {
          await repo.ticketEtiqueta.create({
            data: { ticketId: ticket.id, etiquetaId: etiqueta.id },
          })
        }
      }
    } catch (err) {
      log?.(`[Mail] No se pudo asignar etiqueta "Solicitante respondió": ${(err as Error).message}`)
    }
  }

  if (adjuntosValidos(email.attachments).length) {
    await repo.adjunto.createMany({
      data: adjuntosValidos(email.attachments).map((att) => {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
        return {
          ticketId: ticket.id,
          comentarioId: comment.id,
          nombre: att.filename || 'sin_nombre',
          tipo: att.contentType || 'application/octet-stream',
          url: '',
          data: buf.toString('base64'),
          tamaño: buf.length,
        }
      }),
    })
  }

  // Actualizar el hilo de conversación del ticket con los Message-IDs entrantes
  const incomingRefs = headerThreadIds(headers).join(' ')
  if (incomingMessageId || incomingRefs) {
    await repo.ticket.update({
      where: { id: ticket.id },
      data: {
        ultimoMessageId: incomingMessageId ?? ticket.ultimoMessageId ?? null,
        threadRefs: mergeThreadRefs(ticket.threadRefs, incomingRefs, incomingMessageId),
      },
    })
  }

  log?.(`[Mail] Respuesta vinculada a ${codigo} como comentario`)
  return ticket
}

/**
 * Punto de entrada unificado: procesa un correo entrante y crea ticket (nuevo)
 * o comenta el ticket existente (respuesta). Devuelve el resultado o null.
 */
export async function handleIncomingEmail(
  deps: IngestDeps,
  email: IncomingEmail
): Promise<IngestResult | null> {
  const { repo, log } = deps
  const headers = {
    inReplyTo: (email as any).inReplyTo || (email as any).headers?.get?.('in-reply-to'),
    references: (email as any).references || (email as any).headers?.get?.('references'),
    messageId: (email as any).messageId || (email as any).headers?.get?.('message-id'),
  }
  const decision = decideIncomingEmail(email.from, email.subject, headers)
  const fromEmail = decision.fromEmail
  const incomingMessageId = normalizeMessageId(headers.messageId)

  if (!fromEmail) {
    log?.('[Mail] Ignorado: sin dirección de remitente')
    return null
  }

  // Anti-loop: correos generados por el propio sistema que llegan al INBOX
  if (deps.systemFroms?.some((addr) => addr?.trim().toLowerCase() === fromEmail)) {
    log?.(`[Mail] Ignorado: correo saliente del propio sistema (${fromEmail})`)
    return null
  }

  // Deduplicación: si el Message-ID ya fue ingerido, no repetir ticket/comentario
  // (ocurre cuando un correo procesado se vuelve a marcar como no leído).
  if (incomingMessageId && repo.correoProcesado?.findUnique) {
    const previo = await repo.correoProcesado.findUnique({ where: { messageId: incomingMessageId } })
    if (previo) {
      log?.(`[Mail] Correo ya procesado (${incomingMessageId}); se omite`)
      return {
        kind: 'duplicate',
        ticketId: previo.ticketId ?? '',
        codigo: previo.codigo ?? '',
        reply: previo.origen === 'reply',
      }
    }
  }

  /** Registra el Message-ID ingerido para no procesarlo dos veces. */
  const registrarCorreo = async (ticketId: string, codigo: string, origen: 'new' | 'reply') => {
    if (!incomingMessageId || !repo.correoProcesado?.create) return
    try {
      await repo.correoProcesado.create({
        data: { messageId: incomingMessageId, ticketId, codigo, origen },
      })
    } catch (err) {
      // Carrera u otro escáner ya lo registró: no debe romper el proceso.
      log?.(`[Mail] No se pudo registrar el Message-ID: ${(err as Error).message}`)
    }
  }

  // Respuesta a ticket existente → crear comentario
  if (decision.kind === 'reply' && decision.codigo) {
    const ticketPorCodigo = await repo.ticket.findUnique({ where: { codigo: decision.codigo } })
    if (ticketPorCodigo) {
      const replied = await replyToTicket(deps, email, ticketPorCodigo, headers)
      if (replied) {
        await registrarCorreo(replied.id, decision.codigo, 'reply')
        return { kind: 'reply', ticketId: replied.id, codigo: decision.codigo, reply: true }
      }
    } else {
      log?.(`[Mail] Respuesta a ticket inexistente: ${decision.codigo}`)
    }
    // Si el código no existe, no crear ticket nuevo con un código fantasma:
    // continuamos al flujo normal pero sin el código en el asunto.
  }

  // Respuesta por cabeceras de hilo aunque el asunto NO traiga código TK:
  // el solicitante respondió al correo original o a un mensaje previo del hilo.
  const candidatos = headerThreadIds(headers)
  if (candidatos.length) {
    let ticketHilo: TicketHilo | null = null
    if (repo.ticket.findFirst) {
      ticketHilo = await repo.ticket.findFirst({
        where: { OR: [{ messageId: { in: candidatos } }, { ultimoMessageId: { in: candidatos } }] },
      })
    }
    if (!ticketHilo && repo.comentario.findFirst) {
      const comentarioPrevio = await repo.comentario.findFirst({
        where: { messageId: { in: candidatos } },
        select: { ticketId: true },
      })
      if (comentarioPrevio?.ticketId) {
        ticketHilo = await repo.ticket.findUnique({ where: { id: comentarioPrevio.ticketId } })
      }
    }
    if (ticketHilo) {
      const replied = await replyToTicket(deps, email, ticketHilo, headers)
      if (replied) {
        await registrarCorreo(replied.id, ticketHilo.codigo, 'reply')
        return { kind: 'reply', ticketId: replied.id, codigo: ticketHilo.codigo, reply: true }
      }
    }
  }

  // Obtener o crear el usuario solicitante
  let solicitante = await repo.usuario.findFirst({
    where: { correo: { equals: fromEmail, mode: 'insensitive' } },
  })
  if (!solicitante) {
    const roleId = (await deps.resolveRoleId?.()) || null
    const fromNameRaw = (email.from as any)?.value?.[0]?.name || fromEmail.split('@')[0]
    solicitante = await repo.usuario.create({
      data: {
        nombre: fromNameRaw,
        apellido: '',
        correo: fromEmail,
        userName: `${fromEmail.split('@')[0]}_${Date.now()}`,
        password: null,
        rolId: roleId,
        departamentoId: null,
      },
    })
  }

  // Categoría: auto-clasificación por palabras clave (asunto + cuerpo) cuando
  // hay resolver configurado; si no, la categoría por defecto o la primera.
  let routingScore: {
    categoriaId: string
    categoriaNombre: string
    colaId: string | null
    equipo: { id: string; nombre: string } | null
    supervisor: { id: string; nombre: string; apellido: string } | null
    etiquetas: string[]
  }
  if (deps.resolverCategoria) {
    routingScore = await deps.resolverCategoria({
      asunto: email.subject ?? undefined,
      descripcion:
        typeof email.text === 'string' ? email.text : typeof email.html === 'string' ? email.html : undefined,
      manualCategoriaId: null,
      defaultCategoriaId: deps.defaultCategoriaId?.trim() || null,
    })
    if (!routingScore.categoriaId) {
      log?.('[Mail] Sin categoría aplicable, correo ignorado')
      return null
    }
  } else {
    const porDefecto =
      deps.defaultCategoriaId?.trim()
        ? await repo.categoria.findUnique({ where: { id: deps.defaultCategoriaId.trim() }, select: { id: true, nombre: true, colaDefaultId: true } })
        : null
    const elegida = porDefecto || (await repo.categoria.findFirst({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, colaDefaultId: true } }))
    if (!elegida?.id) {
      log?.('[Mail] Sin categoría por defecto, correo ignorado')
      return null
    }
    routingScore = {
      categoriaId: elegida.id,
      categoriaNombre: elegida.nombre,
      colaId: elegida.colaDefaultId ?? null,
      equipo: null,
      supervisor: null,
      etiquetas: [],
    }
  }
  const categoriaId = routingScore.categoriaId
  const categoriaColaId = routingScore.colaId

  // Código concurrente-safe y SLA por categoría+prioridad
  const lastTickets = await repo.ticket.findMany({ orderBy: { codigo: 'desc' }, take: 10, select: { codigo: true } })
  const codigo = nextTicketCode(lastTickets.map((t: { codigo: string }) => t.codigo))

  const sla = await repo.sla.findFirst({
    where: { categoriaId, prioridad: 'MEDIA' },
  })

  const subject = (email.subject || '(Sin asunto)').substring(0, 200)
  const descripcion = emailBodyToText(email as any, 2000)

  const ticket = await repo.ticket.create({
    data: {
      codigo,
      asunto: subject,
      descripcion,
      estado: 'NUEVO',
      nivelPrioridad: 'MEDIA',
      solicitanteId: solicitante.id,
      categoriaId,
      colaId: routingScore.colaId,
      slaId: sla?.id ?? null,
      equipoId: routingScore.equipo?.id ?? null,
      supervisorId: routingScore.supervisor?.id ?? null,
      origen: 'CORREO',
      // Hilo de conversación: este correo inicia la rama de la plataforma
      messageId: incomingMessageId,
      ultimoMessageId: incomingMessageId,
      threadRefs: incomingMessageId,
    },
    include: { solicitante: { select: { nombre: true, apellido: true, correo: true } } },
  })

  await repo.logTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: solicitante.id,
      accion: 'CREACION',
      valorNuevo: 'Ticket creado desde correo',
    },
  })

  // Auto-etiquetas: categorías adicionales detectadas por palabras clave
  for (const nombreEtiqueta of routingScore.etiquetas) {
    try {
      let etiqueta = await repo.etiqueta?.findFirst({ where: { nombre: nombreEtiqueta } })
      if (!etiqueta) etiqueta = await repo.etiqueta?.create({ data: { nombre: nombreEtiqueta, color: etiquetaColor(nombreEtiqueta) } })
      if (etiqueta) {
        const yaEtiquetado = await repo.ticketEtiqueta?.findFirst({ where: { ticketId: ticket.id, etiquetaId: etiqueta.id } })
        if (!yaEtiquetado) await repo.ticketEtiqueta?.create({ data: { ticketId: ticket.id, etiquetaId: etiqueta.id } })
      }
    } catch (err) {
      log?.(`[Mail] No se pudo asignar la etiqueta "${nombreEtiqueta}": ${(err as Error).message}`)
    }
  }
  if (routingScore.etiquetas.length) {
    await repo.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: solicitante.id,
        accion: 'AUTO_CATEGORIA',
        valorNuevo: `${routingScore.categoriaNombre} (+ etiquetas: ${routingScore.etiquetas.join(', ')})`,
      },
    })
  }
  if (routingScore.equipo) {
    await repo.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: solicitante.id,
        accion: 'ASIGNACION_EQUIPO',
        valorAnterior: 'Sin equipo',
        valorNuevo: routingScore.equipo.nombre,
      },
    })
  }
  if (routingScore.supervisor) {
    await repo.logTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: solicitante.id,
        accion: 'ASIGNACION_SUPERVISOR',
        valorAnterior: 'Sin supervisor',
        valorNuevo: `${routingScore.supervisor.nombre} ${routingScore.supervisor.apellido}`.trim(),
      },
    })
  }

  // Asignación automática por cola, si está configurada (FASE B)
  let agenteAsignadoId: string | null = null
  if (deps.autoAssign && categoriaColaId) {
    try {
      const agente = await deps.autoAssign({ colaId: categoriaColaId })
      if (agente) {
        agenteAsignadoId = agente.id
        await repo.ticket.update({
          where: { id: ticket.id },
          data: { agenteId: agente.id, estado: 'ASIGNADO' },
        })
        await repo.logTicket.create({
          data: {
            ticketId: ticket.id,
            usuarioId: solicitante.id,
            accion: 'ASIGNACION',
            valorAnterior: 'Sin asignar',
            valorNuevo: agente.nombre ? `${agente.nombre} (${agente.id})` : agente.id,
          },
        })
        log?.(`[Mail] Ticket ${codigo} auto-asignado a ${agente.nombre || agente.id}`)
      }
    } catch (err) {
      log?.(`[Mail] Error en asignación automática de ${codigo}: ${(err as Error).message}`)
    }
  }
  void agenteAsignadoId

  if (adjuntosValidos(email.attachments).length) {
    await repo.adjunto.createMany({
      data: adjuntosValidos(email.attachments).map((att) => {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
        return {
          ticketId: ticket.id,
          nombre: att.filename || 'sin_nombre',
          tipo: att.contentType || 'application/octet-stream',
          url: '',
          data: buf.toString('base64'),
          tamaño: buf.length,
        }
      }),
    })
  }

  await registrarCorreo(ticket.id, codigo, 'new')
  log?.(`[Mail] Ticket ${codigo} creado desde correo de ${fromEmail}`)
  return { kind: 'new', ticketId: ticket.id, codigo }
}