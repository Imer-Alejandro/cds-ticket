import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get("days")
    const desdeParam = searchParams.get("desde")
    const hastaParam = searchParams.get("hasta")

    const ahora = hastaParam ? new Date(hastaParam + "T23:59:59") : new Date()
    const desde = desdeParam
      ? new Date(desdeParam + "T00:00:00")
      : new Date(ahora.getTime() - (parseInt(daysParam || "30")) * 24 * 60 * 60 * 1000)

    const [
      totalTickets,
      ticketsPorEstado,
      ticketsPorPrioridad,
      ticketsPorCategoria,
      ticketsPorDia,
      slas,
      topAgentes,
      avgResolucion,
      ticketsPorDepartamento,
      ticketsPorFuente,
    ] = await Promise.all([
      prisma.ticket.count({ where: { fechaCreacion: { gte: desde } } }),
      prisma.ticket.groupBy({ by: ["estado"], _count: true, where: { fechaCreacion: { gte: desde } } }),
      prisma.ticket.groupBy({ by: ["nivelPrioridad"], _count: true, where: { fechaCreacion: { gte: desde } } }),
      prisma.categoria.findMany({
        select: { id: true, nombre: true, _count: { select: { tickets: true } } },
      }),
      getTicketsPorDia(desde),
      getSlaStats(desde),
      getTopAgentes(desde),
      getAvgResolucion(desde),
      getTicketsPorDepartamento(desde),
      prisma.ticket.groupBy({ by: ["origen"], _count: true, where: { fechaCreacion: { gte: desde } } }),
    ])

    const total = await prisma.ticket.count()
    const abiertos = await prisma.ticket.count({ where: { estado: { notIn: ["CERRADO", "RESUELTO"] } } })
    const resueltos = await prisma.ticket.count({ where: { estado: "RESUELTO" } })
    const cerrados = await prisma.ticket.count({ where: { estado: "CERRADO" } })

    return NextResponse.json({
      total,
      abiertos,
      resueltos,
      cerrados,
      enRango: totalTickets,
      ticketsPorEstado: ticketsPorEstado.map((e) => ({ nombre: e.estado, cantidad: e._count })),
      ticketsPorPrioridad: ticketsPorPrioridad.map((p) => ({ nombre: p.nivelPrioridad, cantidad: p._count })),
      ticketsPorCategoria: ticketsPorCategoria.map((c) => ({ nombre: c.nombre, cantidad: c._count.tickets })),
      ticketsPorDia,
      ticketsPorDepartamento,
      ticketsPorFuente: ticketsPorFuente.map((f) => ({ nombre: f.origen, cantidad: f._count })),
      sla: slas,
      topAgentes,
      tiempoResolucionPromedio: avgResolucion,
      fechaDesde: desde.toISOString(),
      fechaHasta: ahora.toISOString(),
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Error al obtener dashboard" }, { status: 500 })
  }
}

async function getTicketsPorDia(desde: Date) {
  const tickets = await prisma.ticket.findMany({
    where: { fechaCreacion: { gte: desde } },
    select: { fechaCreacion: true, fechaResolucion: true, fechaCierre: true },
    orderBy: { fechaCreacion: "asc" },
  })

  const mapa = new Map<string, { creados: number; resueltos: number; cerrados: number }>()

  for (const t of tickets) {
    const diaCreacion = t.fechaCreacion.toISOString().slice(0, 10)
    if (!mapa.has(diaCreacion)) mapa.set(diaCreacion, { creados: 0, resueltos: 0, cerrados: 0 })
    mapa.get(diaCreacion)!.creados++

    if (t.fechaResolucion) {
      const diaRes = t.fechaResolucion.toISOString().slice(0, 10)
      if (!mapa.has(diaRes)) mapa.set(diaRes, { creados: 0, resueltos: 0, cerrados: 0 })
      mapa.get(diaRes)!.resueltos++
    }
    if (t.fechaCierre) {
      const diaCierre = t.fechaCierre.toISOString().slice(0, 10)
      if (!mapa.has(diaCierre)) mapa.set(diaCierre, { creados: 0, resueltos: 0, cerrados: 0 })
      mapa.get(diaCierre)!.cerrados++
    }
  }

  return Array.from(mapa.entries())
    .map(([fecha, datos]) => ({ fecha, ...datos }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

async function getSlaStats(desde: Date) {
  const ticketsConSla = await prisma.ticket.findMany({
    where: { slaId: { not: null }, fechaCreacion: { gte: desde } },
    select: { fechaCreacion: true, fechaResolucion: true, sla: { select: { minutosResolucion: true } } },
  })

  let cumplidos = 0
  let total = 0

  for (const t of ticketsConSla) {
    if (t.fechaResolucion && t.sla) {
      total++
      const minutos = (t.fechaResolucion.getTime() - t.fechaCreacion.getTime()) / 60000
      if (minutos <= t.sla.minutosResolucion) cumplidos++
    }
  }

  return { cumplidos, total, porcentaje: total > 0 ? Math.round((cumplidos / total) * 1000) / 10 : 100 }
}

async function getTopAgentes(desde: Date) {
  const agentes = await prisma.ticket.groupBy({
    by: ["agenteId"],
    _count: true,
    where: { estado: "CERRADO", agenteId: { not: null }, fechaCreacion: { gte: desde } },
    orderBy: { _count: { agenteId: "desc" } },
    take: 10,
  })

  if (agentes.length === 0) return []

  const ids = agentes.map((a) => a.agenteId!).filter(Boolean)
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, apellido: true },
  })
  const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))

  return agentes.map((a) => ({
    agenteId: a.agenteId,
    nombre: usuarioMap.get(a.agenteId!)?.nombre || "Desconocido",
    apellido: usuarioMap.get(a.agenteId!)?.apellido || "",
    total: a._count,
  }))
}

async function getAvgResolucion(desde: Date) {
  const resueltos = await prisma.ticket.findMany({
    where: { fechaResolucion: { not: null }, fechaCreacion: { gte: desde } },
    select: { fechaCreacion: true, fechaResolucion: true },
  })
  if (resueltos.length === 0) return null
  const totalHoras = resueltos.reduce((acc, t) => {
    return acc + (t.fechaResolucion!.getTime() - t.fechaCreacion.getTime()) / 3600000
  }, 0)
  return Math.round((totalHoras / resueltos.length) * 10) / 10
}

async function getTicketsPorDepartamento(desde: Date) {
  const tickets = await prisma.ticket.findMany({
    where: { fechaCreacion: { gte: desde } },
    select: { solicitante: { select: { departamento: { select: { nombre: true } } } } },
  })
  const mapa = new Map<string, number>()
  for (const t of tickets) {
    const dept = t.solicitante.departamento?.nombre || "Sin departamento"
    mapa.set(dept, (mapa.get(dept) || 0) + 1)
  }
  return Array.from(mapa.entries())
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
}
