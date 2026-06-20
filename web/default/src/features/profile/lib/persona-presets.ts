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
import type { Persona } from '../types'

/**
 * Persona-driven UI defaults. Each persona maps to:
 *   - a sidebar_modules JSON string (consumed by hooks/use-sidebar-config.ts'
 *     user-layer filter)
 *   - the default route after login
 *   - the default highlighted card in the Create API Key mode-picker
 *
 * Persona is a UI preference, NOT a permission. Permissions still live on
 * `user.role`. The admin section ('admin') always falls back to the role
 * gate in components/layout/components/app-sidebar.tsx regardless of what
 * persona writes here — non-admin role can't see admin nav even with
 * `admin.enabled = true`.
 */

export type PersonaPreset = {
  sidebarModules: string // serialized JSON, matches SidebarModulesAdminConfig shape
  defaultRoute: '/playground' | '/keys' | '/dashboard/overview'
  defaultCreateMode: 'simple' | 'advanced'
}

const CASUAL_SIDEBAR = {
  // Chat lets casual users actually use AI in-browser without setting up
  // a client. This is the loudest path to first-call.
  chat: { enabled: true, playground: true, chat: true },
  // Casual users still need API Keys — the whole casual persona pitch is
  // "paste your key into the AI app you already use". Keep token visible;
  // hide the request-level audit views (detail/log/midjourney/task) since
  // those are technical.
  console: {
    enabled: true,
    detail: false,
    token: true,
    log: false,
    midjourney: false,
    task: false,
  },
  personal: { enabled: true, topup: true, personal: true },
  // Admin section visibility is also gated by role; setting false here
  // makes the intent explicit.
  admin: { enabled: false },
}

const DEV_SIDEBAR = {
  chat: { enabled: true, playground: true, chat: true },
  console: {
    enabled: true,
    detail: true,
    token: true,
    log: true,
    midjourney: true,
    task: true,
  },
  personal: { enabled: true, topup: true, personal: true },
  admin: { enabled: false },
}

// Team currently mirrors dev. When team-only routes (audit / sub-accounts)
// ship later, they'll be enabled here.
const TEAM_SIDEBAR = DEV_SIDEBAR

export const PERSONA_PRESETS: Record<Persona, PersonaPreset> = {
  casual: {
    sidebarModules: JSON.stringify(CASUAL_SIDEBAR),
    // Land on the key page, NOT Playground — "不做 chat 是红线"
    // (onboarding-v2 §2/§9). /keys is the "决定性一页" (§7.5): it carries the
    // tutorial card + the self-check, which is the golden-path proof step.
    // Decided 2026-06-13 (BUSINESS-LOGIC §0 D10b).
    defaultRoute: '/keys',
    defaultCreateMode: 'simple',
  },
  dev: {
    sidebarModules: JSON.stringify(DEV_SIDEBAR),
    defaultRoute: '/keys',
    defaultCreateMode: 'advanced',
  },
  team: {
    sidebarModules: JSON.stringify(TEAM_SIDEBAR),
    defaultRoute: '/keys',
    defaultCreateMode: 'advanced',
  },
}

/**
 * Persona for legacy users (created before this field existed) and any
 * `setting` JSON we cannot parse. Defaults to 'casual': DeepRouter's paying
 * audience is non-technical (onboarding-v2 §3), so the safe fallback is the
 * guided casual surface (tutorial card + self-check on /keys), not the
 * developer console. Without this, fallback users land on /keys in dev mode
 * with the tutorial card hidden — i.e. "注册成功了不知道该做什么".
 * Decided 2026-06-13 (BUSINESS-LOGIC §0 D10a). New accounts are unaffected:
 * Register stamps the 'unset' sentinel and the persona picker prompts.
 */
export const LEGACY_USER_PERSONA: Persona = 'casual'

/**
 * Sentinel value written by backend Register for new accounts. The
 * authenticated layout prompts the persona picker when it sees this.
 */
export const NEW_USER_PERSONA_SENTINEL = 'unset' as const

/**
 * Resolve the effective persona from the raw `setting` JSON string stored
 * on the user record. Returns either a valid Persona or the sentinel
 * 'unset' (meaning "prompt the picker").
 */
export function resolveEffectivePersona(
  settingRaw: string | undefined | null
): Persona | typeof NEW_USER_PERSONA_SENTINEL {
  if (!settingRaw) return LEGACY_USER_PERSONA
  try {
    const parsed = JSON.parse(settingRaw) as { persona?: string }
    const p = parsed.persona
    if (p === NEW_USER_PERSONA_SENTINEL) return NEW_USER_PERSONA_SENTINEL
    if (p === 'casual' || p === 'dev' || p === 'team') return p
  } catch {
    /* fall through to legacy default */
  }
  return LEGACY_USER_PERSONA
}
