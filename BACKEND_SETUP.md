# CDS Ticket: ejecucion con Docker

Docker Compose ejecuta el frontend Next.js y el backend Express/Socket.IO en
contenedores separados. Ambos se conectan a la misma instancia externa de
CockroachDB configurada por Prisma; no se crea ni se publica una base de datos
local.

## Requisitos

- Docker Engine con Docker Compose v2 en el servidor.
- Acceso de red desde el servidor a CockroachDB y permiso para conectar desde
  su IP de salida.
- Una base de datos de desarrollo o produccion ya creada en CockroachDB.
- Inicio automatico del servicio Docker al arrancar el sistema operativo.

## Preparar el entorno

Desde la carpeta del proyecto, crea el archivo privado de configuracion:

```powershell
Copy-Item .env.docker.example .env.docker
```

Edita `.env.docker` y reemplaza la URL de ejemplo de `DATABASE_URL` por la URL
de conexion de CockroachDB. Configura tambien un `JWT_SECRET` aleatorio y largo.
No compartas ni subas `.env.docker`; esta excluido de Git y de la imagen Docker.

`NEXT_PUBLIC_SOCKET_URL` se incorpora al bundle del navegador durante la
construccion. Para usar la aplicacion desde otros equipos, pon la IP o el DNS
del servidor en `APP_URL` y `NEXT_PUBLIC_SOCKET_URL`, por ejemplo:

```env
APP_URL=https://tickets.midominio.local
NEXT_PUBLIC_SOCKET_URL=https://tickets.midominio.local
BIND_ADDRESS=127.0.0.1
```

Configura un proxy inverso con TLS y certificado confiable para ese nombre, y
permite el acceso al proxy desde la red local. La aplicacion usa cookies
`Secure` en modo produccion. Para acceso solo desde el servidor, conserva
`localhost` y `BIND_ADDRESS=127.0.0.1`. No publiques los puertos directamente a
Internet.

## Aplicacion de migraciones y arranque

Antes de migrar, confirma que `DATABASE_URL` apunta a la base correcta y que
tienes un respaldo si contiene datos importantes. Aplica las migraciones
pendientes y levanta los servicios:

```powershell
docker compose --env-file .env.docker run --build --rm backend npx prisma migrate deploy
docker compose --env-file .env.docker up -d --build
```

Abre `http://localhost:3000` en el servidor, o la URL configurada en `APP_URL`
desde otro equipo. El backend escucha en el puerto 3001 para Socket.IO. Para
revisar estado y logs:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f
```

Los contenedores usan `restart: unless-stopped`: Docker los inicia al arrancar
el servicio Docker y vuelve a iniciarlos si el proceso termina. Asegurate de
habilitar el inicio del servicio Docker con el sistema operativo. Los
healthchecks permiten consultar si responden; la politica de reinicio no
recupera por si sola procesos que permanezcan activos pero no saludables.

Al publicar una nueva version, aplica migraciones pendientes y reconstruye:

```powershell
docker compose --env-file .env.docker run --build --rm backend npx prisma migrate deploy
docker compose --env-file .env.docker up -d --build
```

Para detener los contenedores sin borrar datos de CockroachDB:

```powershell
docker compose --env-file .env.docker down
```

El seed es opcional y debe usarse solo con una base de datos de prueba; crea
usuarios con contrasena inicial `password123`. No lo ejecutes contra una base
de produccion:

```powershell
docker compose --env-file .env.docker run --build --rm backend npx prisma db seed
```

## Desarrollo sin Docker

Para desarrollo local con Node.js, instala dependencias con `npm install`,
configura `DATABASE_URL` en `.env.local` y ejecuta:

```powershell
npm run dev
```

Next.js usa el puerto 3000 y Express/Socket.IO el 3001.
