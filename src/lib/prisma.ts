import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no está definida. Crea un archivo .env.local en la raíz del proyecto con la URL de conexión.'
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

const prismaClientSingleton = () => {
  const adapter = new PrismaPg(createPool())
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
