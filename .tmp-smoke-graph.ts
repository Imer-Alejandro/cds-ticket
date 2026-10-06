import prisma from './src/lib/prisma'
import { loadEmailConfig, saveEmailConfig } from './src/lib/mail/config'
import { getMicrosoftGraphAccessToken } from './src/lib/mail/oauth'
import { sendEmailViaGraph } from './src/lib/mail/graph'

async function main() {
  const config = await loadEmailConfig()
  console.log('authMode:', config.authMode, '| from:', config.fromAddress)

  const accessToken = await getMicrosoftGraphAccessToken(config, async (refreshToken) => {
    await saveEmailConfig({ refreshToken })
  })
  console.log('GRAPH TOKEN OK')

  const ticket = await prisma.ticket.findFirst({
    where: { messageId: { not: null } },
    select: { codigo: true, asunto: true, messageId: true, threadRefs: true, ultimoMessageId: true },
  })
  if (!ticket) {
    console.log('No hay tickets con messageId; no se puede probar el hilo')
    return
  }
  console.log('Ticket:', ticket.codigo, '| messageId:', ticket.messageId, '| ultimo:', ticket.ultimoMessageId)

  await sendEmailViaGraph(accessToken, {
    to: 'iconstanzo@sanchezbusinesscorp.com',
    subject: `[${ticket.codigo}] Prueba: comentario como respuesta del hilo (Graph createReply)`,
    html: '<p>Prueba de comentario enhebrado vía Microsoft Graph <b>createReply</b>. Debe aparecer dentro de la conversación original.</p>',
    headers: {
      inReplyTo: ticket.ultimoMessageId || ticket.messageId || undefined,
      references: ticket.threadRefs || undefined,
    },
  })
  console.log('GRAPH REPLY OK ->', ticket.codigo)
}

main().catch((error) => {
  console.error('GRAPH SMOKE FALLÓ:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
