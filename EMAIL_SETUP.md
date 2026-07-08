# Configuración de Correos y Canalización de Peticiones

## 📧 Pasos de Configuración

### 1. **Acceder a Configuración de Correo**
- Ve a `/dashboard/settings/email`
- Allí encontrarás dos secciones: **IMAP** (recepción) y **SMTP** (envío)

### 2. **Configurar IMAP (Recepción de Correos)**

#### Para **Gmail**:
```
Servidor IMAP: imap.gmail.com
Puerto: 993
SSL/TLS: ✓ Habilitado
Usuario: tu-email@gmail.com
Contraseña: [Contraseña de aplicación - NO tu contraseña de Gmail]
Carpeta: INBOX
```

**⚠️ Importante**: Debes crear una **contraseña de aplicación** en tu cuenta de Google:
1. Ve a [myaccount.google.com/security](https://myaccount.google.com/security)
2. Habilita verificación en dos pasos
3. Genera una "contraseña de aplicación" para Mail
4. Usa esa contraseña aquí

#### Para **Microsoft 365/Outlook**:
```
Servidor IMAP: imap.outlook.com
Puerto: 993
SSL/TLS: ✓ Habilitado
Usuario: tu-email@empresa.onmicrosoft.com
Contraseña: Tu contraseña de Microsoft
Carpeta: INBOX
```

#### Para **proveedores personalizados** (GoDaddy, Zoho, etc.):
- Contacta al proveedor por los datos de servidor IMAP
- Puerto usualmente es 993 con SSL/TLS

### 3. **Configurar SMTP (Envío de Correos)**

#### Para **Gmail**:
```
Servidor SMTP: smtp.gmail.com
Puerto: 587
SSL/TLS: ✓ Habilitado
Usuario: tu-email@gmail.com
Contraseña: [Misma contraseña de aplicación]
```

#### Para **Microsoft 365/Outlook**:
```
Servidor SMTP: smtp-mail.outlook.com
Puerto: 587
SSL/TLS: ✓ Habilitado
Usuario: tu-email@empresa.onmicrosoft.com
Contraseña: Tu contraseña
```

### 4. **Configurar Canalización de Peticiones**

#### a) **Seleccionar Categoría por Defecto**
- Elige la categoría a la que irán los correos (ej: "Soporte Técnico", "Ventas", etc.)
- Los correos sin asunto específico usarán esta categoría
- Puedes crear reglas de automatización después

#### b) **Configurar Intervalo de Verificación**
- Define cada cuántos segundos el sistema debe revisar correos
- Recomendado: **60 segundos** (cada minuto)
- Valores bajos = más rápido pero más carga del servidor
- Valores altos = más lento pero menos recursos

### 5. **Guardar Configuración**
- Haz clic en **"Guardar configuración"**
- Deberías ver un mensaje de éxito
- El sistema está listo para procesar correos

## 🔄 Cómo Funcionan los Correos

### Proceso Automático:
1. **Sistema revisa IMAP** cada X segundos
2. **Detecta correos nuevos** (sin leer)
3. **Crea un Ticket automáticamente** con:
   - **Asunto**: Del correo (o "Sin asunto")
   - **Descripción**: Contenido del correo
   - **Solicitante**: El remitente (se crea usuario si no existe)
   - **Categoría**: La que configuraste como "por defecto"
   - **Estado**: NUEVO
   - **Prioridad**: MEDIA
   - **Origen**: CORREO

### Responder Correos:
- Cuando agregas un comentario al ticket, el sistema puede enviar una respuesta al correo original
- Los comentarios marcados como "internos" NO se envían al solicitante

## 🧪 Probar la Configuración

### Opción 1: Manual (Recomendado para probar)
```bash
# Haz una solicitud POST a:
POST /api/email/process

# Con header:
Authorization: Bearer [CRON_SECRET]
```

### Opción 2: Automático
El sistema procesará correos automáticamente según el intervalo configurado. Puedes:
- Enviar un correo a tu dirección configurada
- Esperar el intervalo configurado
- Verificar que aparezca un nuevo ticket en el dashboard

## 📋 Checklist de Configuración

- [ ] He obtenido las credenciales IMAP correctas
- [ ] He obtenido las credenciales SMTP correctas
- [ ] He habilitado "Recepción automática de correos"
- [ ] He configurado la categoría por defecto
- [ ] He configurado el intervalo de verificación
- [ ] He guardado la configuración
- [ ] He enviado un correo de prueba
- [ ] El ticket se creó automáticamente

## 🚨 Troubleshooting

### "Error al guardar la configuración"
- Verifica que todos los campos obligatorios estén completos
- Intenta probar primero la conexión IMAP manualmente

### "Los correos no aparecen como tickets"
- Verifica que la recepción automática esté habilitada
- Revisa los logs del servidor en `/api/email/process`
- Asegúrate que los correos sean "no leídos" (UNSEEN)
- Verifica que exista la categoría por defecto

### "No puedo conectarme a IMAP"
- Verifica usuario y contraseña
- Comprueba que el servidor sea accesible desde tu red
- Para Gmail, usa contraseña de aplicación, NO tu contraseña
- Intenta con `SSL/TLS` habilitado

### "Los correos de respuesta no llegan"
- Verifica credenciales SMTP
- Asegúrate que el puerto SMTP sea correcto (usualmente 587 o 465)
- Revisa la carpeta de spam del solicitante

## 🔐 Variables de Entorno

Para el procesamiento automático via cron job, establece:

```env
CRON_SECRET=tu_clave_secreta_aqui
```

Luego desde tu servicio de cron (Vercel, GitHub Actions, etc.):

```bash
curl -X POST https://tudominio.com/api/email/process \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 📞 Soporte

Si tienes problemas con la configuración:
1. Revisa los logs del servidor
2. Verifica la documentación de tu proveedor de email
3. Asegúrate que 2FA está correctamente configurado
