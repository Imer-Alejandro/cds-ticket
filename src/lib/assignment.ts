/**
 * Asignación automática de tickets a agentes (Día de la evaluación: FASE B).
 *
 * Lógica: se elige el agente con MENOR carga (menos tickets abiertos) dentro
 * del equipo de la cola del ticket. Como desempate se usa round-robin:
 * si hay empate, se excluye al último agente asignado en esa cola.
 *
 * La lógica pura es testeable sin base de datos (inyección de repo).
 */

export interface AgenteCandidato {
  id: string
  nombre?: string
}

export interface CargaCandidato {
  agenteId: string
  activos: number
}

export interface AssignmentRepo {
  /** Miembros (agentes) del equipo de la cola. */
  getCandidatos(colaId: string): Promise<AgenteCandidato[]>
  /** Nº de tickets abiertos (NUEVO/ASIGNADO/EN_PROGRESO) por agente. */
  getCargas(agenteIds: string[]): Promise<CargaCandidato[]>
  /** Último agente asignado en la cola (para round-robin). */
  getUltimoAsignado(colaId: string): Promise<string | null>
}

export function pickLeastLoaded(
  candidatos: AgenteCandidato[],
  cargas: CargaCandidato[],
  ultimoAsignadoId?: string | null
): AgenteCandidato | null {
  if (!candidatos.length) return null

  const cargaMap = new Map<string, number>()
  for (const c of cargas) cargaMap.set(c.agenteId, c.activos)

  const conCarga = candidatos.map(c => ({ ...c, activos: cargaMap.get(c.id) ?? 0 }))
  const min = Math.min(...conCarga.map(c => c.activos))
  const menosCargados = conCarga.filter(c => c.activos === min)

  if (menosCargados.length === 1) return menosCargados[0]

  // Empate → round-robin: rotar al último asignado en la cola
  if (ultimoAsignadoId) {
    const candidatosRestantes = menosCargados.filter(c => c.id !== ultimoAsignadoId)
    if (candidatosRestantes.length) return candidatosRestantes[0]
  }
  return menosCargados[0]
}

/** Envuelve pickLeastLoaded con el repo inyectado (probable en tests). */
export async function autoAssignAgent(
  repo: AssignmentRepo,
  colaId: string | null
): Promise<AgenteCandidato | null> {
  if (!colaId) return null
  const candidatos = await repo.getCandidatos(colaId)
  if (!candidatos.length) return null
  const [cargas, ultimoAsignado] = await Promise.all([
    repo.getCargas(candidatos.map(c => c.id)),
    repo.getUltimoAsignado(colaId),
  ])
  return pickLeastLoaded(candidatos, cargas, ultimoAsignado)
}