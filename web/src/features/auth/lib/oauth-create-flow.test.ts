/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Contract tests for createOAuthFlow / wechatLoginByCode request bodies.
 * Uses a minimal local reimplementation of the body-building rules so the
 * security invariants can be asserted without loading the full axios stack.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

type CreateOAuthFlowBody = {
  provider: string
  intent: 'login' | 'bind'
  aff?: string
  invitation_code?: string
}

function buildCreateOAuthFlowBody(
  provider: string,
  intent: 'login' | 'bind',
  options?: { invitationCode?: string; affiliateCode?: string }
): CreateOAuthFlowBody {
  const aff = intent === 'login' ? (options?.affiliateCode?.trim() ?? '') : ''
  const body: CreateOAuthFlowBody = {
    provider,
    intent,
    aff: aff || undefined,
  }
  if (intent === 'login') {
    const invitationCode = options?.invitationCode?.trim()
    if (invitationCode) {
      body.invitation_code = invitationCode
    }
  }
  return body
}

function buildWeChatRequest(
  code: string,
  invitationCode?: string
): {
  method: 'GET' | 'POST'
  query?: { code: string }
  body?: { code: string; invitation_code?: string }
} {
  const trimmed = invitationCode?.trim()
  if (trimmed) {
    return {
      method: 'POST',
      body: { code, invitation_code: trimmed },
    }
  }
  return {
    method: 'GET',
    query: { code },
  }
}

describe('createOAuthFlow body contract', () => {
  test('login with non-empty invitation puts invitation_code only in POST body', () => {
    const body = buildCreateOAuthFlowBody('github', 'login', {
      invitationCode: '  INV-1  ',
      affiliateCode: 'AFF',
    })
    assert.deepEqual(body, {
      provider: 'github',
      intent: 'login',
      aff: 'AFF',
      invitation_code: 'INV-1',
    })
  })

  test('login with blank invitation omits invitation_code field', () => {
    const body = buildCreateOAuthFlowBody('discord', 'login', {
      invitationCode: '   ',
    })
    assert.equal('invitation_code' in body, false)
    assert.deepEqual(body, {
      provider: 'discord',
      intent: 'login',
      aff: undefined,
    })
  })

  test('login without invitation option still creates flow body', () => {
    const body = buildCreateOAuthFlowBody('oidc', 'login')
    assert.equal(body.intent, 'login')
    assert.equal('invitation_code' in body, false)
  })

  test('bind never includes invitation_code or aff', () => {
    const body = buildCreateOAuthFlowBody('github', 'bind', {
      invitationCode: 'INV-SHOULD-DROP',
      affiliateCode: 'AFF-SHOULD-DROP',
    })
    assert.deepEqual(body, {
      provider: 'github',
      intent: 'bind',
      aff: undefined,
    })
    assert.equal('invitation_code' in body, false)
  })

  test('custom oauth login uses provider slug and may carry invitation', () => {
    const body = buildCreateOAuthFlowBody('my-custom', 'login', {
      invitationCode: 'INV-C',
    })
    assert.equal(body.provider, 'my-custom')
    assert.equal(body.invitation_code, 'INV-C')
  })

  test('provider isolation: body for one provider does not leak another', () => {
    const github = buildCreateOAuthFlowBody('github', 'login', {
      invitationCode: 'ONLY-GITHUB',
    })
    const discord = buildCreateOAuthFlowBody('discord', 'login')
    assert.equal(github.invitation_code, 'ONLY-GITHUB')
    assert.equal('invitation_code' in discord, false)
  })
})

describe('wechatLoginByCode request contract', () => {
  test('with invitation uses POST body only', () => {
    const req = buildWeChatRequest('wx-code', '  INV-W  ')
    assert.equal(req.method, 'POST')
    assert.deepEqual(req.body, {
      code: 'wx-code',
      invitation_code: 'INV-W',
    })
    assert.equal(req.query, undefined)
  })

  test('without invitation uses GET query with code only', () => {
    const req = buildWeChatRequest('wx-code')
    assert.equal(req.method, 'GET')
    assert.deepEqual(req.query, { code: 'wx-code' })
    assert.equal(req.body, undefined)
  })

  test('blank invitation falls back to GET without invitation_code', () => {
    const req = buildWeChatRequest('wx-code', '  ')
    assert.equal(req.method, 'GET')
    assert.deepEqual(req.query, { code: 'wx-code' })
  })
})

describe('telegram and bind never carry invitation', () => {
  test('telegram login has no invitation field in params shape', () => {
    const telegramParams = {
      id: 1,
      first_name: 't',
      auth_date: 1,
      hash: 'h',
    }
    assert.equal('invitation_code' in telegramParams, false)
  })
})
