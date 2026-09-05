import { describe, expect, it } from 'vitest'

import {
  buildDomainBindReturnURL,
  buildDomainLoginHandoffURL,
  buildDomainBindHandoffURL,
  buildDomainOAuthReturnURL,
  parseDomainBindHandoff,
  parseDomainBindReturn,
  parseDomainLoginHandoff,
  parseDomainOAuthReturn,
  readDomainLoginHandoffTicket,
} from '../domain-oauth-handoff'

describe('domain OAuth handoff contract', () => {
  it('builds a custom-origin bridge URL with the ticket only in the fragment', () => {
    const handoff = parseDomainLoginHandoff({
      action: 'domain_login_handoff',
      target_origin: 'https://alpha.yeschoy.io',
      ticket: 'opaque ticket/value',
    })

    expect(handoff).not.toBeNull()
    if (!handoff) throw new Error('expected login handoff')
    const url = new URL(buildDomainLoginHandoffURL(handoff))
    expect(url.origin).toBe('https://alpha.yeschoy.io')
    expect(url.pathname).toBe('/oauth/handoff')
    expect(url.search).toBe('')
    expect(readDomainLoginHandoffTicket(url.hash)).toBe('opaque ticket/value')
  })

  it('rejects malformed actions and targets that are not pure HTTPS origins', () => {
    expect(parseDomainLoginHandoff(null)).toBeNull()
    expect(
      parseDomainLoginHandoff({
        action: 'domain_login_handoff',
        target_origin: 'https://alpha.yeschoy.io/path',
        ticket: 'ticket',
      })
    ).toBeNull()
    expect(
      parseDomainLoginHandoff({
        action: 'domain_login_handoff',
        target_origin: 'http://alpha.yeschoy.io',
        ticket: 'ticket',
      })
    ).toBeNull()
  })

  it('builds a custom-origin sign-in return without provider query data', () => {
    const target = parseDomainOAuthReturn({
      action: 'domain_oauth_return',
      target_origin: 'https://alpha.yeschoy.io',
    })
    expect(target).not.toBeNull()
    if (!target) throw new Error('expected OAuth return')
    expect(buildDomainOAuthReturnURL(target)).toBe(
      'https://alpha.yeschoy.io/sign-in'
    )
  })

  it('builds a bind bridge URL while keeping the ticket in the fragment', () => {
    const handoff = parseDomainBindHandoff({
      action: 'domain_bind_handoff',
      target_origin: 'https://alpha.yeschoy.io',
      provider: 'github',
      ticket: 'bind-ticket',
    })
    expect(handoff).not.toBeNull()
    if (!handoff) throw new Error('expected bind handoff')
    const url = new URL(buildDomainBindHandoffURL(handoff))
    expect(url.origin).toBe('https://alpha.yeschoy.io')
    expect(url.searchParams.get('mode')).toBe('bind')
    expect(url.searchParams.get('provider')).toBe('github')
    expect(url.searchParams.has('ticket')).toBe(false)
    expect(readDomainLoginHandoffTicket(url.hash)).toBe('bind-ticket')
  })

  it('returns a failed bind to its opener without putting the result in the query', () => {
    const bindReturn = parseDomainBindReturn({
      action: 'domain_bind_return',
      target_origin: 'https://alpha.yeschoy.io',
      provider: 'github',
      result: 'target_unavailable',
    })
    expect(bindReturn).not.toBeNull()
    if (!bindReturn) throw new Error('expected bind return')
    const url = new URL(buildDomainBindReturnURL(bindReturn))
    expect(url.origin).toBe('https://alpha.yeschoy.io')
    expect(url.pathname).toBe('/oauth/handoff')
    expect(url.searchParams.get('mode')).toBe('bind-return')
    expect(url.searchParams.get('provider')).toBe('github')
    expect(url.searchParams.has('result')).toBe(false)
    expect(new URLSearchParams(url.hash.slice(1)).get('result')).toBe(
      'target_unavailable'
    )
  })
})
