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
import { getBuildVersion } from '@/lib/build-metadata'

const RELOADED_SERVER_VERSION_KEY = 'newapi:reloaded-server-version'
const VERSION_CHECK_INTERVAL_MS = 60_000

interface VersionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface CheckFrontendVersionOptions {
  currentVersion: string | undefined
  fetchVersion: () => Promise<string | undefined>
  reload: (version: string) => void
  storage: VersionStorage
}

async function fetchServerVersion(): Promise<string | undefined> {
  const response = await fetch('/api/frontend-version', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return undefined
  const result = (await response.json()) as {
    data?: { version?: unknown }
    success?: boolean
  }
  const version = result.success ? result.data?.version : undefined
  return typeof version === 'string' && version.length > 0 ? version : undefined
}

export async function checkFrontendVersion(
  options: CheckFrontendVersionOptions
): Promise<void> {
  if (!options.currentVersion) return

  try {
    const serverVersion = await options.fetchVersion()
    if (!serverVersion || serverVersion === options.currentVersion) return
    try {
      if (
        options.storage.getItem(RELOADED_SERVER_VERSION_KEY) === serverVersion
      ) {
        return
      }
      options.storage.setItem(RELOADED_SERVER_VERSION_KEY, serverVersion)
    } catch {
      // The URL guard still bounds reloads when browser storage is disabled.
    }
    options.reload(serverVersion)
  } catch {
    // A failed version check must not interrupt the current page.
  }
}

let currentCheck: Promise<void> | undefined

function currentFrontendVersion(): string | undefined {
  return (
    document.querySelector<HTMLMetaElement>('meta[name="frontend-version"]')
      ?.content || getBuildVersion()
  )
}

export function frontendUpdateUrl(
  href: string,
  version: string
): string | undefined {
  const url = new URL(href)
  if (url.searchParams.get('_app_build') === version) return undefined
  url.searchParams.set('_app_build', version)
  return url.href
}

export function checkCurrentFrontendVersion(): Promise<void> {
  if (currentCheck) return currentCheck
  currentCheck = checkFrontendVersion({
    currentVersion: currentFrontendVersion(),
    fetchVersion: fetchServerVersion,
    reload: (version) => {
      const url = frontendUpdateUrl(window.location.href, version)
      if (url) window.location.replace(url)
    },
    storage: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
    },
  }).finally(() => {
    currentCheck = undefined
  })
  return currentCheck
}

export function startFrontendVersionSync(): () => void {
  if (typeof window === 'undefined' || !currentFrontendVersion()) {
    return () => {}
  }

  const check = () => void checkCurrentFrontendVersion()
  const checkWhenVisible = () => {
    if (document.visibilityState === 'visible') check()
  }

  check()
  const interval = window.setInterval(check, VERSION_CHECK_INTERVAL_MS)
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', checkWhenVisible)

  return () => {
    window.clearInterval(interval)
    window.removeEventListener('focus', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', checkWhenVisible)
  }
}
