#!/usr/bin/env node

/**
 * Script para probar la configuración de email
 * Uso: npx ts-node scripts/test-email.ts
 */

import prisma from '../src/lib/prisma'
import { loadEmailConfig } from '../src/lib/mail/config'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

async function testEmailConfiguration() {
  console.log('🧪 Iniciando pruebas de configuración de email...\n')

  // Test 1: Cargar configuración
  console.log('Test 1: Cargar configuración...')
  try {
    const config = await loadEmailConfig()
    console.log('✅ Configuración cargada correctamente')
    console.log(`   - IMAP: ${config.imapHost}:${config.imapPort}`)
    console.log(`   - SMTP: ${config.smtpHost}:${config.smtpPort}`)
    console.log(`   - Habilitado: ${config.enabled ? 'Sí' : 'No'}`)
    console.log()

    if (!config.enabled) {
      console.warn('⚠️  La recepción de correos está deshabilitada')
      return
    }

    // Test 2: Conectar a IMAP
    console.log('Test 2: Conectar a servidor IMAP...')
    if (!config.imapHost || !config.imapUser || !config.imapPass) {
      console.error('❌ Configuración IMAP incompleta')
      return
    }

    const imap = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: {
        user: config.imapUser,
        pass: config.imapPass,
      },
    })

    try {
      await imap.connect()
      console.log('✅ Conexión IMAP exitosa')

      const mailbox = await imap.mailboxOpen(config.imapFolder)
      console.log(`✅ Mailbox abierto: ${config.imapFolder}`)
      console.log(`   - Mensajes totales: ${mailbox.exists}`)
      console.log(`   - Mensajes sin leer: ${mailbox.unseen}`)
      console.log()

      // Test 3: Conectar a SMTP
      console.log('Test 3: Conectar a servidor SMTP...')
      if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
        console.error('❌ Configuración SMTP incompleta')
        return
      }

      const smtp = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      })

      try {
        await smtp.verify()
        console.log('✅ Conexión SMTP exitosa')
        console.log()

        // Test 4: Verificar categoría por defecto
        console.log('Test 4: Verificar categoría por defecto...')
        if (config.defaultCategoriaId) {
          const cat = await prisma.categoria.findUnique({
            where: { id: config.defaultCategoriaId },
          })
          if (cat) {
            console.log(`✅ Categoría existe: ${cat.nombre}`)
          } else {
            console.error(`❌ Categoría no encontrada: ${config.defaultCategoriaId}`)
          }
        } else {
          console.warn('⚠️  No hay categoría por defecto configurada')
          const cat = await prisma.categoria.findFirst()
          if (cat) {
            console.log(`   → Se usará: ${cat.nombre}`)
          }
        }
        console.log()

        // Resumen
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✅ ¡Todas las pruebas pasaron!')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('\n📧 El sistema está listo para procesar correos.')
        console.log('   Próximo paso: Envía un correo de prueba a tu dirección configurada\n')

        await imap.logout()
      } catch (error) {
        console.error('❌ Error en conexión SMTP:', error)
      }
    } catch (error) {
      console.error('❌ Error en conexión IMAP:', error)
    } finally {
      try {
        await imap.logout()
      } catch (e) {
        // Ignorar
      }
    }
  } catch (error) {
    console.error('❌ Error cargando configuración:', error)
  }
}

testEmailConfiguration().catch(console.error)
