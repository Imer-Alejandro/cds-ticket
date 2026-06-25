import 'dotenv/config'
import { hash } from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL no está definida')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. ROLES
  const adminRole = await prisma.rol.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { nombre: 'Administrador', permisos: { all: true } },
    create: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Administrador', permisos: { all: true } },
  })

  const supervisorRole = await prisma.rol.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000002', nombre: 'Supervisor', permisos: { canManageTickets: true, canViewReports: true } },
  })

  const agenteRole = await prisma.rol.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000003', nombre: 'Agente', permisos: { canManageTickets: true } },
  })

  const usuarioRole = await prisma.rol.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000004', nombre: 'Usuario', permisos: { canCreateTickets: true } },
  })

  // 2. DEPARTAMENTOS
  const itDept = await prisma.departamento.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Tecnología', descripcion: 'Departamento de TI' },
  })
  
  const rrhhDept = await prisma.departamento.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000002', nombre: 'Recursos Humanos', descripcion: 'Departamento de RRHH' },
  })

  // 3. USUARIOS (Admin, Supervisor, Agente, Usuario)
  const defaultPassword = await hash('password123', 10)

  const admin = await prisma.usuario.upsert({
    where: { correo: 'admin@sanchezbusinesscorp.com' },
    update: {},
    create: { nombre: 'Admin', apellido: 'Sistema', correo: 'admin@sanchezbusinesscorp.com', userName: 'admin', password: defaultPassword, departamentoId: itDept.id, rolId: adminRole.id },
  })

  const supervisor = await prisma.usuario.upsert({
    where: { correo: 'supervisor@sanchezbusinesscorp.com' },
    update: {},
    create: { nombre: 'Supervisor', apellido: 'Infra', correo: 'supervisor@sanchezbusinesscorp.com', userName: 'supervisor', password: defaultPassword, departamentoId: itDept.id, rolId: supervisorRole.id },
  })

  const agente1 = await prisma.usuario.upsert({
    where: { correo: 'agente1@sanchezbusinesscorp.com' },
    update: {},
    create: { nombre: 'Agente', apellido: 'Soporte', correo: 'agente1@sanchezbusinesscorp.com', userName: 'agente1', password: defaultPassword, departamentoId: itDept.id, rolId: agenteRole.id },
  })

  const usuario1 = await prisma.usuario.upsert({
    where: { correo: 'usuario1@sanchezbusinesscorp.com' },
    update: {},
    create: { nombre: 'Juan', apellido: 'Perez', correo: 'usuario1@sanchezbusinesscorp.com', userName: 'juanp', password: defaultPassword, departamentoId: rrhhDept.id, rolId: usuarioRole.id },
  })

  // 4. EQUIPOS Y COLAS
  const equipoNivel1 = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Equipo Soporte Nivel 1', supervisorId: supervisor.id },
  })

  const colaNivel1 = await prisma.cola.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Soporte Nivel 1', equipoId: equipoNivel1.id },
  })
  
  // Agregar agente1 al equipoNivel1
  await prisma.equipoUsuario.upsert({
    where: { equipoId_usuarioId: { equipoId: equipoNivel1.id, usuarioId: agente1.id } },
    update: {},
    create: { equipoId: equipoNivel1.id, usuarioId: agente1.id },
  })

  // 5. CATEGORIAS Y SLAs
  const catHardware = await prisma.categoria.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Hardware / Correo', descripcion: 'Problemas físicos y de correo', colaDefaultId: colaNivel1.id },
  })

  const catSoftware = await prisma.categoria.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000002', nombre: 'Software / ERP', descripcion: 'Problemas de sistemas', colaDefaultId: colaNivel1.id },
  })

  const prioridades = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA']
  
  // Crear SLAs simples para Hardware (ejemplo del documento)
  const slasHardware = [
    { prio: 'CRITICA', res: 120, sol: 480 }, // 2h / 8h
    { prio: 'ALTA', res: 480, sol: 1440 }, // 8h / 24h
    { prio: 'MEDIA', res: 1440, sol: 2880 }, // 24h / 48h
    { prio: 'BAJA', res: 2880, sol: 5760 }, // 48h / 96h
  ]

  for (const s of slasHardware) {
    const slaId = `00000000-0000-0000-0001-00000000000${prioridades.indexOf(s.prio)}`
    await prisma.sla.upsert({
      where: { id: slaId },
      update: {},
      create: { id: slaId, categoriaId: catHardware.id, prioridad: s.prio, minutosRespuesta: s.res, minutosResolucion: s.sol },
    })
  }

  console.log('Seed inicial de MVP completado con éxito.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

