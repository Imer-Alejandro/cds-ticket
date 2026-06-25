import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.usuario.findMany({
      include: {
        rol: true,
        departamento: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
    
    // We only return safe info for mock purposes
    const safeUsers = users.map(u => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      rol: u.rol.nombre,
      departamento: u.departamento?.nombre,
    }));

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Error fetching mock users', error);
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
  }
}
