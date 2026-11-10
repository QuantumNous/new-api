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

/** How long www.newapi.ai gets to answer before www.newapi.pro is used. */
export const PLUGIN_SITE_TIMEOUT_MS = 10_000

/** How long `auto` stays on www.newapi.pro after newapi.ai did not answer. */
export const PLUGIN_SITE_FALLBACK_MS = 24 * 60 * 60 * 1000

/**
 * `fetch` for plugin lists, plugin files and logos. Requests to www.newapi.ai
 * go to www.newapi.pro when the administrator picked it, or for a day after
 * newapi.ai did not answer within 10 seconds; both sites serve the same
 * plugins, and every file is still checked against its sha256. Other
 * addresses are fetched unchanged. Saved source addresses stay on newapi.ai.
 */
export async function fetchFromPluginSite(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (input instanceof Request) return globalThis.fetch(input, init)
  let url: URL
  try {
    url = new URL(String(input))
  } catch {
    return globalThis.fetch(input, init)
  }
  if (url.origin !== AI_ORIGIN) return globalThis.fetch(input, init)

  const proUrl = PRO_ORIGIN + url.pathname + url.search
  const state = usePluginSiteStore.getState()
  if (state.site === 'pro' || state.fallbackUntil > Date.now()) {
    return globalThis.fetch(proUrl, init)
  }

  // The timer only covers getting an answer; a slow download is not cut off.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), PLUGIN_SITE_TIMEOUT_MS)
  init.signal?.addEventListener('abort', () => timeout.abort(), { once: true })
  try {
    return await globalThis.fetch(url.href, { ...init, signal: timeout.signal })
  } catch (error) {
    if (init.signal?.aborted) throw error
    // newapi.ai did not answer: an HTTP error status is an answer and is
    // returned above as is.
    usePluginSiteStore
      .getState()
      .rememberFallback(Date.now() + PLUGIN_SITE_FALLBACK_MS)
    return globalThis.fetch(proUrl, init)
  } finally {
    clearTimeout(timer)
  }
}
