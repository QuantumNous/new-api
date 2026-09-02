export interface DomainLoginHandoff {
  action: 'domain_login_handoff'
  targetOrigin: string
  ticket: string
}

export interface DomainOAuthReturn {
  action: 'domain_oauth_return'
  targetOrigin: string
}

export interface DomainBindHandoff {
  action: 'domain_bind_handoff'
  targetOrigin: string
  provider: string
  ticket: string
}

const providerPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function parseHTTPSOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const target = new URL(value)
    if (
      target.protocol !== 'https:' ||
      target.username !== '' ||
      target.password !== '' ||
      target.pathname !== '/' ||
      target.search !== '' ||
      target.hash !== ''
    ) {
      return null
    }
    return target.origin
  } catch {
    return null
  }
}

export function parseDomainLoginHandoff(
  value: unknown
): DomainLoginHandoff | null {
  if (
    !isRecord(value) ||
    value.action !== 'domain_login_handoff' ||
    typeof value.ticket !== 'string' ||
    value.ticket.trim() === ''
  ) {
    return null
  }

  const targetOrigin = parseHTTPSOrigin(value.target_origin)
  if (!targetOrigin) return null
  return {
    action: 'domain_login_handoff',
    targetOrigin,
    ticket: value.ticket,
  }
}

export function buildDomainLoginHandoffURL(
  handoff: DomainLoginHandoff
): string {
  const url = new URL('/oauth/handoff', handoff.targetOrigin)
  url.hash = new URLSearchParams({ ticket: handoff.ticket }).toString()
  return url.toString()
}

export function parseDomainBindHandoff(
  value: unknown
): DomainBindHandoff | null {
  if (
    !isRecord(value) ||
    value.action !== 'domain_bind_handoff' ||
    typeof value.provider !== 'string' ||
    !providerPattern.test(value.provider) ||
    typeof value.ticket !== 'string' ||
    value.ticket.trim() === ''
  ) {
    return null
  }
  const targetOrigin = parseHTTPSOrigin(value.target_origin)
  if (!targetOrigin) return null
  return {
    action: 'domain_bind_handoff',
    targetOrigin,
    provider: value.provider,
    ticket: value.ticket,
  }
}

export function buildDomainBindHandoffURL(handoff: DomainBindHandoff): string {
  const url = new URL('/oauth/handoff', handoff.targetOrigin)
  url.searchParams.set('mode', 'bind')
  url.searchParams.set('provider', handoff.provider)
  url.hash = new URLSearchParams({ ticket: handoff.ticket }).toString()
  return url.toString()
}

export function readDomainLoginHandoffTicket(hash: string): string | null {
  const params = new URLSearchParams(
    hash.startsWith('#') ? hash.slice(1) : hash
  )
  const tickets = params.getAll('ticket')
  if (tickets.length !== 1 || tickets[0].trim() === '') return null
  return tickets[0]
}

export function parseDomainOAuthReturn(
  value: unknown
): DomainOAuthReturn | null {
  if (!isRecord(value) || value.action !== 'domain_oauth_return') return null
  const targetOrigin = parseHTTPSOrigin(value.target_origin)
  if (!targetOrigin) return null
  return { action: 'domain_oauth_return', targetOrigin }
}

export function buildDomainOAuthReturnURL(target: DomainOAuthReturn): string {
  return new URL('/sign-in', target.targetOrigin).toString()
}
