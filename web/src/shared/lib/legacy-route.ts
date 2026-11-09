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
const legacyOrigin = 'https://legacy-route.invalid'

const legacyConsoleRoutes: Record<string, string> = {
  '/console': '/app/workspace',
  '/console/models': '/admin/models',
  '/console/deployment': '/admin/models/deployments',
  '/console/subscription': '/admin/subscriptions',
  '/console/channel': '/admin/channels',
  '/console/token': '/app/keys',
  '/console/playground': '/app/playground',
  '/console/redemption': '/admin/redemption-codes',
  '/console/user': '/admin/users',
  '/console/personal': '/app/profile',
  '/console/log': '/app/usage-logs',
  '/console/midjourney': '/app/usage-logs/drawing',
  '/console/task': '/app/usage-logs/task',
}

const legacySettingsTabs: Record<string, string> = {
  operation: '/admin/system-settings/operations/behavior',
  dashboard: '/admin/system-settings/content/dashboard',
  chats: '/admin/system-settings/content/chat',
  drawing: '/admin/system-settings/content/drawing',
  payment: '/admin/system-settings/billing/payment',
  ratio: '/admin/system-settings/billing/model-pricing',
  ratelimit: '/admin/system-settings/security/rate-limit',
  models: '/admin/system-settings/models/global',
  'model-deployment': '/admin/system-settings/models/model-deployment',
  performance: '/admin/system-settings/operations/performance',
  system: '/admin/system-settings/site/system-info',
  other: '/admin/system-settings/site/system-info',
}

function normalizeLegacyPath(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

function buildTargetHref(targetPath: string, source: URL): string {
  const target = new URL(targetPath, legacyOrigin)
  source.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) {
      target.searchParams.append(key, value)
    }
  })
  target.hash = source.hash
  return `${target.pathname}${target.search}${target.hash}`
}

/**
 * Build a migration target, but never return a redirect onto the exact same
 * location. A self-redirect re-enters the root guard and, for routes that are
 * already canonical, either loops or resets navigation state for no reason.
 */
function buildLegacyTarget(targetPath: string, source: URL): string | null {
  const href = buildTargetHref(targetPath, source)
  const target = new URL(href, legacyOrigin)
  if (
    target.pathname === normalizeLegacyPath(source.pathname) &&
    target.search === source.search &&
    target.hash === source.hash
  ) {
    return null
  }
  return href
}

export function resolveLegacyRoute(rawHref: string): string | null {
  let source: URL
  try {
    source = new URL(rawHref, legacyOrigin)
  } catch {
    return null
  }

  const pathname = normalizeLegacyPath(source.pathname)
  // `/login` is already the canonical sign-in route. Redirecting it to itself
  // re-ran the root guard (and re-appended `registered=1`) on every visit.
  if (pathname === '/login') {
    return null
  }
  if (pathname === '/forbidden') {
    return buildLegacyTarget('/403', source)
  }
  if (pathname === '/console/topup') {
    return buildLegacyTarget('/app/wallet', source)
  }
  if (pathname === '/console/setting') {
    const tab = source.searchParams.get('tab') ?? ''
    const target = legacySettingsTabs[tab] ?? '/admin/system-settings'
    return buildLegacyTarget(target, source)
  }
  if (pathname === '/console/chat') {
    return buildLegacyTarget('/app/workspace', source)
  }
  if (pathname.startsWith('/console/chat/')) {
    const chatID = pathname.slice('/console/chat/'.length)
    return buildLegacyTarget(
      chatID ? `/app/chat/${chatID}` : '/app/workspace',
      source
    )
  }

  const target = legacyConsoleRoutes[pathname]
  if (target) return buildLegacyTarget(target, source)
  if (pathname.startsWith('/console/')) {
    return buildLegacyTarget('/app/workspace', source)
  }

  return null
}
