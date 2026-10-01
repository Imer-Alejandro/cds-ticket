export interface MicrosoftOAuthEnvironment {
  tenantId: string
  clientId: string
  clientSecret: string
}

export function getMicrosoftOAuthEnvironment(): MicrosoftOAuthEnvironment {
  return {
    tenantId: process.env.MICROSOFT_TENANT_ID?.trim() || '',
    clientId: process.env.MICROSOFT_CLIENT_ID?.trim() || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET?.trim() || '',
  }
}

export function hasMicrosoftOAuthEnvironment(config: MicrosoftOAuthEnvironment) {
  return Boolean(config.tenantId && config.clientId && config.clientSecret)
}