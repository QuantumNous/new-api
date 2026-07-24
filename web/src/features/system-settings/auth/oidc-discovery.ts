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
import { api } from '@/lib/api'

export interface OIDCDiscoveryDocument {
  authorization_endpoint?: string
  token_endpoint?: string
  userinfo_endpoint?: string
  scopes_supported?: string[]
}

export interface OIDCDiscoveryResponse {
  success: boolean
  message?: string
  data?: {
    well_known_url?: string
    discovery?: OIDCDiscoveryDocument
  }
}

type OIDCDiscoveryClient = {
  post: (
    path: string,
    body: { well_known_url: string }
  ) => Promise<{ data: OIDCDiscoveryResponse }>
}

export async function discoverOIDCEndpoints(
  wellKnownUrl: string,
  client: OIDCDiscoveryClient = api
): Promise<OIDCDiscoveryResponse> {
  const response = await client.post('/api/custom-oauth-provider/discovery', {
    well_known_url: wellKnownUrl,
  })
  return response.data
}

export function getOIDCEndpointSettings(discovery: OIDCDiscoveryDocument) {
  return {
    authorization_endpoint: discovery.authorization_endpoint || '',
    token_endpoint: discovery.token_endpoint || '',
    user_info_endpoint: discovery.userinfo_endpoint || '',
  }
}
