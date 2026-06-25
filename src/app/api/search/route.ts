import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    if (!q || q.length < 1) return NextResponse.json([])

    const tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { codigo: { contains: q, mode: "insensitive" } },
          { asunto: { contains: q, mode: "insensitive" } },
          { solicitante: { nombre: { contains: q, mode: "insensitive" } } },
          { solicitante: { apellido: { contains: q, mode: "insensitive" } } },
          { solicitante: { correo: { contains: q, mode: "insensitive" } } },
          { agente: { nombre: { contains: q, mode: "insensitive" } } },
          { agente: { apellido: { contains: q, mode: "insensitive" } } },
        ],
      },
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
