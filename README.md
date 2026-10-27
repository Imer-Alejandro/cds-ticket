# CDS Ticket

Sistema de tickets con frontend Next.js y backend Express/Socket.IO. Prisma usa
CockroachDB como proveedor; la base de datos puede permanecer en un servidor
externo mientras la aplicacion corre localmente en Docker.

## Inicio rapido con Docker

Requiere Docker Engine y Docker Compose v2. Copia `.env.docker.example` a
`.env.docker`, configura la URL de CockroachDB y un `JWT_SECRET`, luego ejecuta:

```powershell
docker compose --env-file .env.docker run --build --rm backend npx prisma migrate deploy
docker compose --env-file .env.docker up -d --build
```

La aplicacion queda en `http://localhost:3000`; Socket.IO usa el puerto 3001.
Compose reinicia los servicios si el servidor o un proceso se reinicia. Para
configurar acceso desde otros equipos, variables, firewall, migraciones y
operacion diaria, consulta [BACKEND_SETUP.md](./BACKEND_SETUP.md).
