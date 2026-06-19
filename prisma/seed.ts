import 'dotenv/config'
import prisma from '../src/lib/prisma'

async function main() {
  // Crear roles básicos
  const adminRole = await prisma.rol.create({
    data: {
      nombre: 'Administrador',
      permisos: { all: true },
    },
  })

  const supervisorRole = await prisma.rol.create({
    data: {
      nombre: 'Supervisor',
      permisos: { canManageTickets: true, canViewReports: true },
    },
  })

  const agentRole = await prisma.rol.create({
    data: {
      nombre: 'Agente',
      permisos: { canManageTickets: true },
    },
  })

  const userRole = await prisma.rol.create({
    data: {
      nombre: 'Usuario',
      permisos: { canCreateTickets: true },
    },
  })

  // Crear departamento inicial
  const itDept = await prisma.departamento.create({
    data: {
      nombre: 'Tecnología',
      descripcion: 'Departamento de TI',
    },
  })

  import { hash } from 'bcryptjs'
  const adminPassword = await hash('admin123', 10)

  // Crear usuario administrador
  await prisma.usuario.create({
    data: {
      nombre: 'Admin',
      apellido: 'Sistema',
      correo: 'admin@sanchezbusinesscorp.com',
      userName: 'admin',
      password: adminPassword,
      telefono: '809-555-5555',
      departamentoId: itDept.id,
      rolId: adminRole.id,
    },
  })

  console.log('Seed inicial completado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
