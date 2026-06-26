# CDS Ticket - Backend Setup

## Estructura de la aplicación

Esta aplicación está dividida en dos partes:

### Frontend (Next.js)
- **Puerto**: 3000
- **Ubicación**: `/src/app`
- **Comando**: `npm run dev`

### Backend (Express + Socket.IO)
- **Puerto**: 3001
- **Ubicación**: `/backend`
- **Comando**: `npm run dev:backend`

## Configuración

### Paso 1: Copiar variables de entorno

```bash
# En la raíz del proyecto
cp .env.example .env.local

# En la carpeta del backend
cp backend/.env.example backend/.env.local
```

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Configurar la base de datos

```bash
# Ejecutar migraciones de Prisma
npx prisma migrate dev

# (Opcional) Ejecutar seed
npx prisma db seed
```

## Ejecución en desarrollo

### Opción 1: Ejecutar ambos servidores (recomendado)

```bash
npm run dev:all
```

Esto iniciará:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

### Opción 2: Ejecutar por separado

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run dev:backend
```

## Ejecución en producción

```bash
# Build
npm run build

# Start
npm start
```

## Servicios en el Backend

### Socket.IO
- **URL**: `http://localhost:3001`
- **Autenticación**: JWT token
- **Eventos**:
  - `notificacion` - Notificaciones generales
  - `nuevoTicket` - Nuevo ticket creado

### Mail Listener
- **Función**: Escucha nuevos correos IMAP
- **Intervalo**: Configurable desde la BD (por defecto: 60 segundos)
- **Acción**: Crea automáticamente tickets desde correos

## Estructura del Backend

```
backend/
├── server.ts              # Punto de entrada
├── src/
│   ├── socket.ts         # Socket.IO setup
│   └── mail.ts           # Mail listener logic
├── lib/
│   ├── auth.ts           # Auth utilities (re-export de src)
│   └── email-config.ts   # Email configuration loader
└── tsconfig.json
```

## Variables de entorno

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - URL de la API (por defecto: http://localhost:3000)
- `NEXT_PUBLIC_SOCKET_URL` - URL del backend Socket.IO (por defecto: http://localhost:3001)

### Backend (backend/.env.local)
- `BACKEND_PORT` - Puerto del servidor (por defecto: 3001)
- `NODE_ENV` - Entorno (development, production)
- `DATABASE_URL` - URL de conexión a PostgreSQL

## Troubleshooting

### "Socket.IO no se conecta"
- Asegúrate de que el backend esté ejecutándose en el puerto correcto
- Verifica que `NEXT_PUBLIC_SOCKET_URL` apunte a la URL correcta
- Revisa la consola del navegador para errores de conexión

### "Mail listener no se inicia"
- Verifica que la configuración de email esté habilitada en la BD
- Revisa los logs del backend para errores IMAP

### "AsyncLocalStorage error" (anterior a estos cambios)
- Este error ya no ocurrirá. Next.js ahora se ejecuta en modo normal sin servidor personalizado.
