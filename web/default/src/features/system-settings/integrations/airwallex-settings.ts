export const CONFIGURED_SECRET_PLACEHOLDER = '***configured***'

export type AirwallexSettingsValues = {
  enabled: boolean
  accounts: string
  allowedPaymentMethods: string
  paymentMethodsCacheTTLSeconds: number
  opsEnabled: boolean
  httpTimeoutSeconds: number
}

export type AirwallexAccountForm = {
  biz: string
  enabled: boolean
  base_url: string
  client_id: string
  api_key: string
  login_as: string
  webhook_secret: string
  apiKeyConfigured: boolean
  webhookSecretConfigured: boolean
}

type AirwallexAccountOption = {
  enabled?: boolean
  base_url?: string
  client_id?: string
  login_as?: string
  api_key?: string
  webhook_secret?: string
}

const DEFAULT_ACCOUNT: AirwallexAccountForm = {
  biz: 'b2c',
  enabled: false,
  base_url: 'https://api.airwallex.com',
  client_id: '',
  api_key: '',
  login_as: '',
  webhook_secret: '',
  apiKeyConfigured: false,
  webhookSecretConfigured: false,
}

function isConfiguredSecret(value: unknown) {
  return String(value || '').trim() === CONFIGURED_SECRET_PLACEHOLDER
}

function hasSecret(value: unknown) {
  return String(value || '').trim().length > 0
}

export function parseAirwallexAccountsForForm(
  raw: string
): AirwallexAccountForm[] {
  try {
    const parsed = JSON.parse(raw || '{}') as Record<
      string,
      AirwallexAccountOption
    >
    const entries = Object.entries(parsed || {})
      .filter(([biz]) => biz.trim())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([biz, account]) => ({
        biz,
        enabled: account.enabled === true,
        base_url: String(account.base_url || ''),
        client_id: String(account.client_id || ''),
        api_key: isConfiguredSecret(account.api_key)
          ? ''
          : String(account.api_key || ''),
        login_as: String(account.login_as || ''),
        webhook_secret: isConfiguredSecret(account.webhook_secret)
          ? ''
          : String(account.webhook_secret || ''),
        apiKeyConfigured: hasSecret(account.api_key),
        webhookSecretConfigured: hasSecret(account.webhook_secret),
      }))

    return entries.length > 0 ? entries : [{ ...DEFAULT_ACCOUNT }]
  } catch {
    return [{ ...DEFAULT_ACCOUNT }]
  }
}

export function serializeAirwallexAccounts(
  accounts: AirwallexAccountForm[]
): string {
  const normalized = accounts.reduce<Record<string, AirwallexAccountOption>>(
    (result, account) => {
      const biz = account.biz.trim()
      if (!biz) {
        return result
      }

      result[biz] = {
        enabled: account.enabled,
        base_url: account.base_url.trim(),
        client_id: account.client_id.trim(),
        api_key: account.api_key.trim()
          ? account.api_key.trim()
          : account.apiKeyConfigured
            ? CONFIGURED_SECRET_PLACEHOLDER
            : '',
        login_as: account.login_as.trim(),
        webhook_secret: account.webhook_secret.trim()
          ? account.webhook_secret.trim()
          : account.webhookSecretConfigured
            ? CONFIGURED_SECRET_PLACEHOLDER
            : '',
      }
      return result
    },
    {}
  )

  return JSON.stringify(normalized, null, 2)
}

export function parseAllowedPaymentMethods(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    // Fall through to comma/space separated input.
  }

  return raw
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatAllowedPaymentMethods(methods: string[]): string {
  return methods
    .map((method) => method.trim())
    .filter(Boolean)
    .join(', ')
}

export function serializeAllowedPaymentMethods(raw: string): string {
  return JSON.stringify(parseAllowedPaymentMethods(raw))
}
