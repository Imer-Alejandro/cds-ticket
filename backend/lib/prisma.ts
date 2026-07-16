import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no está definida. Asegúrate de tener un archivo .env con la URL de conexión.'
    )
  }

  const needsSsl =
    process.env.NODE_ENV === 'production' ||
    /sslmode=(require|verify-full|verify-ca)/i.test(connectionString) ||
    connectionString.includes('cockroachlabs.cloud')

  return new Pool({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
}

let prisma: PrismaClient

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg(createPool())
    prisma = new PrismaClient({ adapter })
  }
  return prisma
}
