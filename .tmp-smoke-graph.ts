import { loadEmailConfig, saveEmailConfig } from './src/lib/mail/config'
import { getMicrosoftGraphAccessToken } from './src/lib/mail/oauth'
import { sendEmailViaGraph } from './src/lib/mail/graph'

async function main() {
  const config = await loadEmailConfig()
  console.log('authMode:', config.authMode, '| from:', config.fromAddress, '| RT:', config.refreshToken ? 'si' : 'NO')

  const accessToken = await getMicrosoftGraphAccessToken(config, async (refreshToken) => {
    await saveEmailConfig({ refreshToken })
  })
  console.log('GRAPH TOKEN OK')

  await sendEmailViaGraph(config, accessToken, {
    to: 'iconstanzo@sanchezbusinesscorp.com',
    subject: '[TK-99999] Prueba de envío vía Microsoft Graph API',
    html: '<p>Prueba del nuevo canal de envío por Microsoft Graph (SMTP AUTH está bloqueado en el tenant).</p>',
  })
  console.log('GRAPH SEND OK')
}

main().catch((error) => {
  console.error('GRAPH SMOKE FALLÓ:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
