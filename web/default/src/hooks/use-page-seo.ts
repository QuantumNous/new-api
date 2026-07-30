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
import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import {
  applySeo,
  buildDefaultJsonLd,
  clearSeoOverride,
  DEFAULT_SEO_DESCRIPTION,
  getSeoOverride,
  resolveRouteSeo,
  setSeoOverride,
  type SeoInput,
} from '@/lib/seo'
import { useSystemConfigStore } from '@/stores/system-config-store'

function applyRouteSeo(
  pathname: string,
  systemName: string | undefined,
  logo: string | undefined
) {
  const siteName = systemName?.trim() || 'New API'
  const resolved = resolveRouteSeo(pathname, siteName)
  const override = getSeoOverride(pathname)
  const base: SeoInput = {
    ...resolved,
    ...override,
    siteName: override?.siteName?.trim() || siteName,
    image: override?.image || logo || '/logo.png',
    path: override?.path || resolved.path,
    noindex: override?.noindex ?? resolved.noindex,
  }
  if (
    !base.noindex &&
    (base.path === '/' || resolved.path === '/') &&
    !base.jsonLd
  ) {
    base.jsonLd = buildDefaultJsonLd({
      siteName: base.siteName || siteName,
      description: base.description || DEFAULT_SEO_DESCRIPTION,
      logo: base.image || logo || '/logo.png',
    })
  }
  applySeo(base)
}

/**
 * Keeps document head in sync with the active client route and system name.
 * Mount once near the app root. Pages call useSeo() to register richer titles;
 * overrides are merged here so root effects cannot clobber page SEO.
 */
export function usePageSeo() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })
  const systemName = useSystemConfigStore((s) => s.config.systemName)
  const logo = useSystemConfigStore((s) => s.config.logo)

  useEffect(() => {
    applyRouteSeo(pathname, systemName, logo)
  }, [pathname, systemName, logo])
}

/**
 * Page-level SEO override. Prefer this in feature components that know
 * dynamic titles (model name, doc title, etc.).
 */
export function useSeo(input: SeoInput | null | undefined) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })
  const systemName = useSystemConfigStore((s) => s.config.systemName)
  const logo = useSystemConfigStore((s) => s.config.logo)

  useEffect(() => {
    if (!input) return
    const path = input.path || pathname
    const siteName = input.siteName?.trim() || systemName?.trim() || 'New API'
    setSeoOverride(path, {
      image: input.image || logo || '/logo.png',
      ...input,
      path,
      siteName,
    })
    applyRouteSeo(pathname, systemName, logo)
    return () => {
      clearSeoOverride(path)
    }
  }, [input, pathname, systemName, logo])
}
