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
import { usePluginSiteStore } from '@/stores/plugin-site-store'

const AI_ORIGIN = 'https://www.newapi.ai'
const PRO_ORIGIN = 'https://www.newapi.pro'

/** Whether an address is on www.newapi.ai, so the site choice applies to it. */
export function followsPluginSite(address: string): boolean {
  try {
    return new URL(address).origin === AI_ORIGIN
  } catch {
    return false
  }
}

/**
 * `fetch` for plugin lists, plugin files and logos. Requests to www.newapi.ai
 * go to the backup site www.newapi.pro when the user picked it; both sites
 * serve the same plugins, and every file is still checked against its sha256.
 * Other addresses are fetched unchanged. Saved source addresses stay on
 * newapi.ai.
 */
export function fetchFromPluginSite(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (
    usePluginSiteStore.getState().site !== 'pro' ||
    input instanceof Request
  ) {
    return globalThis.fetch(input, init)
  }
  let url: URL
  try {
    url = new URL(String(input))
  } catch {
    return globalThis.fetch(input, init)
  }
  if (url.origin !== AI_ORIGIN) return globalThis.fetch(input, init)
  return globalThis.fetch(PRO_ORIGIN + url.pathname + url.search, init)
}
