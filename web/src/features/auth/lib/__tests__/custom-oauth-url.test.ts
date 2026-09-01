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
*/
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { CustomOAuthProviderInfo } from '../../types'
import { buildCustomOAuthUrl } from '../oauth'

const provider: CustomOAuthProviderInfo = {
  id: 1,
  name: 'Example SSO',
  slug: 'example-sso',
  icon: '',
  client_id: 'client-id',
  authorization_endpoint: 'https://sso.example.test/authorize?prompt=login',
  scopes: 'openid profile email',
  pkce_enabled: true,
}

const flow = {
  flowToken: 'flow-token',
  codeChallenge: 'challenge-value',
  codeChallengeMethod: 'S256' as const,
}

describe('custom OAuth authorization URL', () => {
  test('includes the server-provided S256 challenge when enabled', () => {
    const url = new URL(
      buildCustomOAuthUrl(provider, 'https://dashboard.example.test/oauth/example-sso', flow)
    )

    assert.equal(url.searchParams.get('client_id'), 'client-id')
    assert.equal(url.searchParams.get('state'), 'flow-token')
    assert.equal(url.searchParams.get('code_challenge'), 'challenge-value')
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('scope'), 'openid profile email')
  })

  test('does not send PKCE parameters when disabled', () => {
    const url = new URL(
      buildCustomOAuthUrl(
        { ...provider, pkce_enabled: false },
        'https://dashboard.example.test/oauth/example-sso',
        flow
      )
    )

    assert.equal(url.searchParams.get('state'), 'flow-token')
    assert.equal(url.searchParams.has('code_challenge'), false)
    assert.equal(url.searchParams.has('code_challenge_method'), false)
  })
})
