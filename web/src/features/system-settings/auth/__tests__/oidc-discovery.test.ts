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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  discoverOIDCEndpoints,
  getOIDCEndpointSettings,
  type OIDCDiscoveryResponse,
} from '../oidc-discovery'

describe('OIDC discovery', () => {
  test('requests the discovery document through the same-origin backend API', async () => {
    const expectedResponse: OIDCDiscoveryResponse = {
      success: true,
      data: {
        discovery: {
          authorization_endpoint: 'https://issuer.example.com/authorize',
          token_endpoint: 'https://issuer.example.com/token',
          userinfo_endpoint: 'https://issuer.example.com/userinfo',
        },
      },
    }
    const requests: Array<{ path: string; body: unknown }> = []

    const response = await discoverOIDCEndpoints(
      'https://issuer.example.com/.well-known/openid-configuration',
      {
        post: async (path, body) => {
          requests.push({ path, body })
          return { data: expectedResponse }
        },
      }
    )

    assert.deepEqual(requests, [
      {
        path: '/api/custom-oauth-provider/discovery',
        body: {
          well_known_url:
            'https://issuer.example.com/.well-known/openid-configuration',
        },
      },
    ])
    assert.equal(response, expectedResponse)
  })

  test('maps discovery fields to the global OIDC setting names', () => {
    assert.deepEqual(
      getOIDCEndpointSettings({
        authorization_endpoint: 'https://issuer.example.com/authorize',
        token_endpoint: 'https://issuer.example.com/token',
        userinfo_endpoint: 'https://issuer.example.com/userinfo',
      }),
      {
        authorization_endpoint: 'https://issuer.example.com/authorize',
        token_endpoint: 'https://issuer.example.com/token',
        user_info_endpoint: 'https://issuer.example.com/userinfo',
      }
    )
  })
})
