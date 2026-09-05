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
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'

export interface GuideAddress {
  /** e.g. https://api.example.com */
  host: string
  /** e.g. https://api.example.com/v1 */
  baseUrl: string
  /** e.g. https://api.example.com/v1/chat/completions */
  fullUrl: string
  /** Replace {{HOST}} / {{BASE_URL}} / {{FULL_URL}} placeholders. */
  fill: (text: string) => string
}

/**
 * Resolves the deployment's public API address from the runtime status
 * (admin-configured server_address), falling back to the current origin.
 * Guide content never hardcodes a domain: all addresses flow through here.
 */
export function useGuideAddress(): GuideAddress {
  const { status } = useStatus()
  // /api/status returns a flat payload; server_address is not modeled on the
  // SystemStatus interface, so read it through an index cast.
  const serverAddress = (status as Record<string, unknown> | null)
    ?.server_address as string | undefined

  return useMemo(() => {
    const raw = serverAddress || window.location.origin
    const host = raw.replace(/\/+$/, '')
    const baseUrl = `${host}/v1`
    const fullUrl = `${host}/v1/chat/completions`

    const fill = (text: string) =>
      text
        .replaceAll('{{FULL_URL}}', fullUrl)
        .replaceAll('{{BASE_URL}}', baseUrl)
        .replaceAll('{{HOST}}', host)

    return { host, baseUrl, fullUrl, fill }
  }, [serverAddress])
}
