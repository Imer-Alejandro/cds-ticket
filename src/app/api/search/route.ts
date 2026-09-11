import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const puedeVerTodo = hasPermission(session, "tickets.viewAll")
    const puedeVerAsignados = hasPermission(session, "tickets.viewAssigned")
    const puedeVerPropios = hasPermission(session, "tickets.viewOwn")

    if (!puedeVerTodo && !puedeVerAsignados && !puedeVerPropios) {
      return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    if (!q || q.length < 1) return NextResponse.json([])

    const where: Prisma.TicketWhereInput = {
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { asunto: { contains: q, mode: "insensitive" } },
        { solicitante: { nombre: { contains: q, mode: "insensitive" } } },
        { solicitante: { apellido: { contains: q, mode: "insensitive" } } },
        { solicitante: { correo: { contains: q, mode: "insensitive" } } },
        { agente: { nombre: { contains: q, mode: "insensitive" } } },
        { agente: { apellido: { contains: q, mode: "insensitive" } } },
      ],
    }

    if (!puedeVerTodo) {
      const scopeFilters: Prisma.TicketWhereInput[] = []
      if (puedeVerAsignados) {
        const asignadoOR: Prisma.TicketWhereInput[] = [{ agenteId: session.id as string }]
        if (puedeVerPropios) asignadoOR.push({ solicitanteId: session.id as string })
        scopeFilters.push({ OR: asignadoOR })
      } else if (puedeVerPropios) {
        scopeFilters.push({ solicitanteId: session.id as string })
      }
      if (scopeFilters.length) where.AND = scopeFilters
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        asunto: true,
        estado: true,
        nivelPrioridad: true,
        solicitante: { select: { nombre: true, apellido: true } },
        agente: { select: { nombre: true, apellido: true } },
      },
      take: 8,
      orderBy: { fechaCreacion: "desc" },
    })

    return NextResponse.json(tickets)
  } catch {
    return NextResponse.json({ error: "Error al buscar" }, { status: 500 })
  }
}