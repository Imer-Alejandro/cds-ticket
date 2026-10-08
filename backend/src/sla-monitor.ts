import { getPrisma } from '../lib/prisma'
import { computeSlaEvents, type SlaEventType } from '../../src/lib/sla-monitor'
import { createNotification } from '../../src/lib/notifications'
import { enqueueEmail } from '../../src/lib/mail/sender'
import { slaAvisoEmail } from '../../src/lib/mail/templates'
import { toTicketEmailData } from '../../src/lib/mail/notify-email'

let timerHandle: ReturnType<typeof setTimeout> | null = null
let stopped = true

const CHECK_INTERVAL_MS = 60 * 1000

interface Destinatario {
  id: string
  nombre: string
  apellido: string
  correo: string | null
}

interface SlaTicketRow {
  id: string
  codigo: string
  asunto: string
  estado: string
  nivelPrioridad: string
  descripcion: string | null
  fechaCreacion: Date
  fechaPrimeraRespuesta: Date | null
  fechaResolucion: Date | null
  sla: { minutosRespuesta: number; minutosResolucion: number } | null
  agente: { id: string; nombre: string; apellido: string; correo: string | null } | null
  supervisor: { id: string; nombre: string; apellido: string; correo: string | null } | null
}

const ETIQUETA_EVENTO: Record<SlaEventType, string> = {
  AVISO_RESPUESTA: 'SLA_AVISO',
  VENCIDO_RESPUESTA: 'SLA_VENCIDO',
  VENCIDO_RESOLUCION: 'SLA_VENCIDO',
}

function mensajeDeEvento(evento: SlaEventType, codigo: string, sla?: { minutosRespuesta: number; minutosResolucion: number } | null): string {
  switch (evento) {
    case 'AVISO_RESPUESTA':
      return `SLA: ${codigo} alcanzó el 75% del plazo de respuesta (${sla?.minutosRespuesta ?? 0}m)`
    case 'VENCIDO_RESPUESTA':
      return `SLA: ${codigo} superó el plazo máximo de respuesta (${sla?.minutosRespuesta ?? 0}m)`
    case 'VENCIDO_RESOLUCION':
      return `SLA: ${codigo} superó el plazo máximo de resolución (${sla?.minutosResolucion ?? 0}m)`
  }
}

function detalleDeEvento(evento: SlaEventType, sla?: { minutosRespuesta: number; minutosResolucion: number } | null): string {
  switch (evento) {
    case 'AVISO_RESPUESTA':
      return `El ticket no tiene primera respuesta registrada y ya se consumió el 75% del plazo de respuesta (${sla?.minutosRespuesta ?? 0} minutos).`
    case 'VENCIDO_RESPUESTA':
      return `El ticket superó el plazo máximo de respuesta programado (${sla?.minutosRespuesta ?? 0} minutos) sin una primera respuesta.`
    case 'VENCIDO_RESOLUCION':
      return `El ticket superó el plazo máximo de resolución programado (${sla?.minutosResolucion ?? 0} minutos) y sigue abierto.`
  }
}

async function runCheck(): Promise<number> {
  const prisma = getPrisma()
  const tickets = (await prisma.ticket.findMany({
    where: { slaId: { not: null }, estado: { in: ['NUEVO', 'ASIGNADO', 'EN_PROGRESO'] } },
    select: {
      id: true,
      codigo: true,
      asunto: true,
      estado: true,
      nivelPrioridad: true,
      descripcion: true,
      fechaCreacion: true,
      fechaPrimeraRespuesta: true,
      fechaResolucion: true,
      sla: { select: { minutosRespuesta: true, minutosResolucion: true } },
      agente: { select: { id: true, nombre: true, apellido: true, correo: true } },
      supervisor: { select: { id: true, nombre: true, apellido: true, correo: true } },
    },
  })) as SlaTicketRow[]

  let procesados = 0
  for (const t of tickets) {
    const yaAvisados = await prisma.slaAviso.findMany({
      where: { ticketId: t.id },
      select: { tipo: true },
    })
    const tiposYa = yaAvisados.map((a) => a.tipo) as SlaEventType[]
    const eventos = computeSlaEvents(
      { id: t.id, codigo: t.codigo, creadoEl: t.fechaCreacion, primeraRespuesta: t.fechaPrimeraRespuesta, resueltoEl: t.fechaResolucion, sla: t.sla },
      tiposYa
    )
    if (!eventos.length) continue

    try {
      await prisma.slaAviso.createMany({
        data: eventos.map((tipo) => ({ ticketId: t.id, tipo })),
      })
    } catch {
      continue
    }
    procesados += eventos.length

    const destinatarios = ([t.agente, t.supervisor].filter(Boolean) as Destinatario[])
    for (const evento of eventos) {
      const tipo = ETIQUETA_EVENTO[evento]
      const mensaje = mensajeDeEvento(evento, t.codigo, t.sla)
      for (const d of destinatarios) {
        await createNotification(d.id, tipo as 'SLA_AVISO' | 'SLA_VENCIDO', mensaje, t.id)
      }
      void enviarCorreo(destinatarios, t, evento)
    }
  }
  return procesados
}

function enviarCorreo(destinatarios: Destinatario[], t: SlaTicketRow, evento: SlaEventType) {
  const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const mailData = toTicketEmailData({
    codigo: t.codigo,
    asunto: t.asunto,
    estado: t.estado,
    nivelPrioridad: t.nivelPrioridad,
    descripcion: t.descripcion,
  })
  const detalle = detalleDeEvento(evento, t.sla)
  const alerta = evento === 'AVISO_RESPUESTA' ? 'Aviso previo de respuesta' : evento === 'VENCIDO_RESPUESTA' ? 'Plazo de respuesta vencido' : 'Plazo de resolución vencido'
  for (const d of destinatarios) {
    if (!d.correo) continue
    try {
      const { subject, html } = slaAvisoEmail(`${d.nombre} ${d.apellido}`.trim(), {
        ...mailData,
        alerta,
        detalle,
        url: `${baseUrl}/tickets/${t.id}`,
      })
      enqueueEmail({ to: d.correo, subject, html })
    } catch (err) {
      console.error(`[SLA] No se pudo encolar correo para ${d.correo}:`, err)
    }
  }
}

async function runLoop() {
  try {
    const n = await runCheck()
    if (n > 0) console.log(`[SLA] ${n} evento(s) de SLA procesado(s)`)
  } catch (err) {
    console.error('[SLA] Error en la revisión periódica:', err)
  }
  if (!stopped) {
    timerHandle = setTimeout(() => void runLoop(), CHECK_INTERVAL_MS)
  }
}

export function startSlaMonitor() {
  stopSlaMonitor()
  stopped = false
  console.log('[SLA] Monitor iniciado (revisa cada 60s los plazos de respuesta/resolución)')
  void runLoop()
}

export function stopSlaMonitor() {
  stopped = true
  if (timerHandle) {
    clearTimeout(timerHandle)
    timerHandle = null
  }
}