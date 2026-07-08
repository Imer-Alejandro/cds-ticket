# 📧 Configuración Completada: Sistema de Correos para Tickets

## ✅ Lo que he implementado:

### 1. **Página de Configuración de Email** 
- Ubicación: `/dashboard/settings/email`
- Campos IMAP para recepción de correos
- Campos SMTP para envío de notificaciones
- Guía integrada con instrucciones por proveedor
- Selector de categoría por defecto

### 2. **Rutas de API**

#### `POST /api/settings/email` 
```typescript
GET  - Obtiene configuración actual
POST - Guarda nuevos datos de email
```

#### `POST /api/email/process`
```typescript
// Procesa correos y crea tickets automáticamente
// Requiere: Authorization: Bearer CRON_SECRET
```

### 3. **Servicio de Procesamiento de Correos**
- Ubicación: `src/lib/mail/listener.ts`
- Funciones principales:
  - `processIncomingEmails()` - Conecta a IMAP y procesa nuevos correos
  - `createTicketFromEmail()` - Convierte correo en ticket
  - `sendEmailReply()` - Envía respuestas a solicitantes

## 🚀 Pasos para empezar:

### Paso 1: Accede a la configuración de email
```
http://localhost:3000/dashboard/settings/email
```

### Paso 2: Configura tus credenciales IMAP
- **Gmail**: imap.gmail.com:993 (con contraseña de aplicación)
- **Outlook**: imap.outlook.com:993
- **Otros**: Consulta la guía integrada

### Paso 3: Configura tus credenciales SMTP
- **Gmail**: smtp.gmail.com:587
- **Outlook**: smtp-mail.outlook.com:587

### Paso 4: Selecciona categoría por defecto
- Los correos se canalizarán a esta categoría automáticamente

### Paso 5: Guarda la configuración
- Haz clic en "Guardar configuración"
- Deberías ver un mensaje de éxito

### Paso 6: Prueba el sistema
```bash
# Opción A: Manual (desde terminal)
curl -X POST http://localhost:3000/api/email/process \
  -H "Authorization: Bearer tu_cron_secret"

# Opción B: Automático
# Configura una tarea cron que envíe la solicitud anterior cada minuto
```

## 📋 Flujo de procesamiento:

```
1. Correo llega a tu buzón
   ↓
2. Sistema revisa IMAP cada X segundos (configurable)
   ↓
3. Detecta correo sin leer (UNSEEN)
   ↓
4. Parsea contenido (asunto, cuerpo, adjuntos)
   ↓
5. Crea/obtiene usuario desde dirección del remitente
   ↓
6. Crea TICKET automáticamente con:
   - Código único (TKT-timestamp)
   - Asunto del correo
   - Contenido como descripción
   - Estado: NUEVO
   - Prioridad: MEDIA
   - Categoría: La configurada por defecto
   - Origen: CORREO
   ↓
7. Marca correo como leído (SEEN)
   ↓
8. Ticket visible en dashboard y cola
```

## 🔧 Variables de Entorno Necesarias

Agrega a tu `.env.local`:

```env
# Para autenticación de cron jobs
CRON_SECRET=tu_clave_secreta_muy_segura_aqui

# (Las demás ya deberían estar configuradas)
DATABASE_URL=...
NEXTAUTH_SECRET=...
```

## 🧪 Prueba rápida

1. **Envía un correo** a tu dirección configurada
2. **Espera el intervalo** configurado (ej: 60 segundos)
3. **Recarga** `/dashboard/tickets`
4. **Deberías ver** un nuevo ticket con origen "CORREO"

## 📞 Funciones disponibles

### Procesar correos manualmente:
```typescript
import { processIncomingEmails } from '@/lib/mail/listener'
await processIncomingEmails()
```

### Enviar respuesta por email:
```typescript
import { sendEmailReply } from '@/lib/mail/listener'
await sendEmailReply('ticket-id', 'Tu mensaje de respuesta')
```

## 🔐 Seguridad

- Las contraseñas se guardan encriptadas en la base de datos
- Solo admins pueden acceder a `/api/settings/email`
- El procesamiento de correos requiere `CRON_SECRET`
- Los usuarios creados automáticamente reciben rol por defecto

## 📊 Base de datos

La configuración se almacena en la tabla `Configuracion`:
```
grupo: 'email'
clave: 'email_imapHost', 'email_smtpPort', etc.
valor: <valores configurados>
```

## ⚠️ Posibles problemas y soluciones

### "Error: Cannot find module 'imap'"
- ✅ Ya está resuelto: usamos `imapflow` que está en package.json

### "IMAP: Login failed"
- Verifica usuario/contraseña
- Para Gmail: usa contraseña de aplicación, no tu contraseña

### "No se crean tickets"
- Verifica que "Recepción automática" esté habilitada
- Verifica que exista una categoría por defecto
- Revisa los logs: `npm run dev` en terminal

### "Los correos no se marcan como leídos"
- Verifica credenciales IMAP
- Asegúrate que tienes permisos en el mailbox

## 🎯 Próximos pasos opcionales

1. **Automatizar procesamiento con cron**: Configura una tarea en Vercel Cron, GitHub Actions, etc.
2. **Crear reglas de automatización**: Canaliza correos por asunto/remitente
3. **Agregar adjuntos**: Procesa archivos adjuntos a tickets
4. **Configurar colas por email**: Múltiples direcciones = múltiples colas

---

¡El sistema está listo para procesar correos! 🎉
