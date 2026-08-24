export type BasicAuthFormValues = {
  PasswordLoginEnabled: boolean
  PasswordRegisterEnabled: boolean
  EmailVerificationEnabled: boolean
  RegisterEnabled: boolean
  EmailDomainRestrictionEnabled: boolean
  EmailAliasRestrictionEnabled: boolean
  EmailDomainWhitelist: string
  rejectSubdomainEmailDomains: boolean
}

type BasicAuthOptionUpdate = { key: string; value: string | boolean }

function normalizeEmailDomainWhitelist(value: string): string {
  return value
    .split(/[\n,]/)
    .map((domain) => domain.trim())
    .filter(Boolean)
    .join(',')
}

export function buildBasicAuthOptionUpdates(
  defaultValues: BasicAuthFormValues,
  data: BasicAuthFormValues
): BasicAuthOptionUpdate[] {
  const updates: BasicAuthOptionUpdate[] = []

  const domains = normalizeEmailDomainWhitelist(data.EmailDomainWhitelist)
  const defaultDomains = normalizeEmailDomainWhitelist(
    defaultValues.EmailDomainWhitelist
  )
  if (domains !== defaultDomains) {
    updates.push({ key: 'EmailDomainWhitelist', value: domains })
  }

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'EmailDomainWhitelist') return
    if (value === defaultValues[key as keyof BasicAuthFormValues]) return
    updates.push({
      key:
        key === 'rejectSubdomainEmailDomains'
          ? 'registration_security.reject_subdomain_email_domains'
          : key,
      value,
    })
  })

  return updates
}
