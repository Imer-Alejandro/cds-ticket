export interface TicketEmailData {
  codigo: string
  asunto: string
  estado: string
  prioridad: string
  descripcion: string
}

export interface AgentEmailData extends TicketEmailData {
  agenteNombre: string
}

interface Escaping {
  (v: string): string
}

const esc: Escaping = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function layout(title: string, body: string, base?: Partial<TicketEmailData>) {
  const ticketHtml = base
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      <tr><td style="font-size:13px;color:#64748b;padding:2px 0">Ticket <strong>${esc(base.codigo ?? '')}</strong></td></tr>
      <tr><td style="font-size:15px;color:#0f172a;padding:2px 0"><strong>${esc(base.asunto ?? '')}</strong></td></tr>
      <tr><td style="font-size:13px;color:#475569;padding:2px 0">Estado: <strong>${esc(base.estado ?? '')}</strong> · Prioridad: <strong>${esc(base.prioridad ?? '')}</strong></td></tr>
    </table>`
    : ''

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#0f172a;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0">
        <strong style="font-size:18px">${title}</strong>
      </div>
      <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;color:#0f172a">
        ${body}${ticketHtml}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">
          Puedes responder directamente a este correo para agregar un comentario a este ticket.
        </p>
      </div>
    </div>
  </body>
</html>`
}

/** Plantilla: acuse de recibo de ticket creado (para el solicitante) */
export function ackTicketEmail(name: string, d: TicketEmailData): { subject: string; html: string } {
  return {
    subject: `Ticket ${d.codigo}: ${d.asunto}`,
    html: layout(
      'Ticket registrado',
      `
      <p>Hola <strong>${esc(name)}</strong>,</p>
      <p>Hemos recibido tu solicitud y le hemos asignado el número <strong>${esc(d.codigo)}</strong>.
      Nuestro equipo la revisará y te notificaremos el avance.</p>
      <p>Descripción:</p>
      <blockquote style="border-left:3px solid #3b82f6;margin:12px 0;padding:8px 16px;color:#334155;background:#f8fafc">
        ${esc(d.descripcion)}
      </blockquote>`,
      d
    ),
  }
}

/** Plantilla: notificación de ticket asignado (para el agente) */
export function assignmentEmail(d: AgentEmailData): { subject: string; html: string } {
  return {
    subject: `Ticket asignado a ti: ${d.codigo} - ${d.asunto}`,
    html: layout(
      'Ticket asignado',
      `
      <p>Hola <strong>${esc(d.agenteNombre)}</strong>,</p>
      <p>Se te ha asignado el siguiente ticket. Por favor ingresa a la plataforma para gestionarlo.</p>
      <p>Descripción:</p>
      <blockquote style="border-left:3px solid #8b5cf6;margin:12px 0;padding:8px 16px;color:#334155;background:#f8fafc">
        ${esc(d.descripcion)}
      </blockquote>`,
      d
    ),
  }
}

/** Plantilla: cambio de estado (para el solicitante) */
export function statusEmail(name: string, d: TicketEmailData & { estadoLabel: string }): { subject: string; html: string } {
  return {
    subject: `[${d.codigo}] Actualización: ${d.estadoLabel}`,
    html: layout(
      'Actualización de tu ticket',
      `
      <p>Hola <strong>${esc(name)}</strong>,</p>
      <p>Tu ticket ha cambiado de estado a <strong>${esc(d.estadoLabel)}</strong>.</p>`,
      d
    ),
  }
}

/** Plantilla: notificación de comentario nuevo (para el solicitante o agente) */
export function commentEmail(name: string, d: TicketEmailData, comment: string): { subject: string; html: string } {
  return {
    subject: `[${d.codigo}] Nuevo comentario en: ${d.asunto}`,
    html: layout(
      'Nuevo comentario',
      `
      <p>Hola <strong>${esc(name)}</strong>,</p>
      <p>Se agregó un nuevo comentario a tu ticket:</p>
      <blockquote style="border-left:3px solid #22c55e;margin:12px 0;padding:8px 16px;color:#334155;background:#f8fafc">
        ${esc(comment)}
      </blockquote>`,
      d
    ),
  }
}
