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
export type ConsoleNavGroupId = 'main' | 'build' | 'account' | 'resources'

export type ConsoleNavItem = {
  id: string
  title: string
  href: string
  group: ConsoleNavGroupId
}

export const CONSOLE_NAV_GROUPS: {
  id: ConsoleNavGroupId
  label: string | null
}[] = [
  { id: 'main', label: null },
  { id: 'build', label: 'Build' },
  { id: 'account', label: 'Account' },
  { id: 'resources', label: 'Resources' },
]

export const CONSOLE_NAV: ConsoleNavItem[] = [
  {
    id: 'overview',
    title: 'Overview',
    href: '/dashboard/overview',
    group: 'main',
  },
  {
    id: 'requests',
    title: 'Requests',
    href: '/usage-logs/common',
    group: 'main',
  },
  { id: 'models', title: 'Models', href: '/pricing', group: 'main' },
  {
    id: 'reports',
    title: 'Reports',
    href: '/dashboard/reports',
    group: 'main',
  },
  {
    id: 'playground',
    title: 'Playground',
    href: '/playground',
    group: 'build',
  },
  { id: 'keys', title: 'API keys', href: '/keys', group: 'build' },
  { id: 'billing', title: 'Wallet', href: '/wallet', group: 'account' },
  {
    id: 'docs',
    title: 'Beginner guide',
    href: '/beginner-guide',
    group: 'resources',
  },
]

export function consoleNavPath(href: string): string {
  return href.split('#')[0] ?? href
}

export function isConsoleNavActive(pathname: string, href: string): boolean {
  const path = consoleNavPath(href)
  if (path === '/pricing') {
    return pathname === '/pricing' || pathname.startsWith('/pricing/')
  }
  if (path === '/wallet') {
    return pathname === '/wallet' || pathname.startsWith('/wallet/')
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}
