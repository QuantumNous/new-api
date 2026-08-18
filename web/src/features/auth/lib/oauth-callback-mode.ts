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
 * Tells apart the two OAuth callbacks that land on the same `/oauth/:provider`
 * route: an account **bind**, which runs inside a popup we opened, and a plain
 * **login** redirect, which runs in the user's own tab.
 *
 * `window.opener` alone cannot make that call. Any tab opened from an external
 * link (`target="_blank"`, Slack, mail clients, another site) carries a live
 * opener, and that opener survives the cross-origin round trip to the identity
 * provider. Such a login callback used to be misread as a bind, so it posted a
 * handshake to a window that speaks no such protocol and sat on the binding
 * screen until the deadline elapsed.
 *
 * The popup we open for a bind is same-origin (`about:blank`) before it is sent
 * to the provider, so we stamp its own sessionStorage. That stamp rides along
 * through the provider round trip and is scoped to the popup alone, which makes
 * it positive proof of a bind flow.
 */

const OAUTH_BIND_FLOW_KEY_PREFIX = 'oauth_bind_flow:'

/** Minimal shape of `sessionStorage`, kept structural so tests can fake it. */
export interface OAuthModeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** Minimal owner shape for safely accessing `sessionStorage`. */
export interface OAuthSessionStorageOwner {
  readonly sessionStorage: OAuthModeStorage
}

/** Minimal shape of `window.opener`. */
export interface OAuthModeOpener {
  closed: boolean
}

export interface OAuthCallbackModeContext {
  opener: OAuthModeOpener | null | undefined
  storage: OAuthModeStorage | null | undefined
}

export type OAuthCallbackMode = 'login' | 'bind'

/**
 * Access `sessionStorage` without letting browser privacy settings crash the
 * OAuth page or binding action.
 */
export function getOAuthSessionStorage(
  owner: OAuthSessionStorageOwner | null | undefined
): OAuthModeStorage | null {
  try {
    return owner?.sessionStorage ?? null
  } catch {
    return null
  }
}

/**
 * Stamp a freshly opened, still same-origin popup as an OAuth bind flow.
 * Call this before navigating the popup to the provider.
 */
export function markOAuthBindPopup(
  storage: OAuthModeStorage | null | undefined,
  provider: string,
  state: string
): boolean {
  if (!storage || !provider || !state) return false

  try {
    const key = `${OAUTH_BIND_FLOW_KEY_PREFIX}${provider}`
    storage.setItem(key, state)
    return storage.getItem(key) === state
  } catch {
    return false
  }
}

/**
 * Resolve how a callback on `/oauth/:provider` should be handled.
 *
 * A bind requires all three pieces of evidence: our own stamp for this exact
 * provider and state, plus a live opener to hand the result back to. Anything
 * else is a login, which is also the safe default — a login callback recovers
 * on its own, while a wrongly assumed bind can only time out.
 */
export function resolveOAuthCallbackMode(
  provider: string,
  state: string,
  { opener, storage }: OAuthCallbackModeContext
): OAuthCallbackMode {
  if (!opener || opener.closed || !storage || !state) return 'login'

  let markedState: string | null = null
  try {
    markedState = storage.getItem(`${OAUTH_BIND_FLOW_KEY_PREFIX}${provider}`)
  } catch {
    return 'login'
  }

  return markedState === state ? 'bind' : 'login'
}
