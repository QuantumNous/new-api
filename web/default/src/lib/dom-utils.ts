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
import {
  BRAND_APPLE_TOUCH_ICON_URL,
  BRAND_FAVICON_URL,
  resolveFaviconUrl,
} from '@/lib/constants'

function upsertFaviconLink(rel: string, href: string, type?: string) {
  const selector = `link[rel="${rel}"]`
  let link = document.querySelector<HTMLLinkElement>(selector)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  if (type) link.type = type
  link.href = href
}

/** Sync browser tab / shortcut / apple-touch icons to the branded favicon asset. */
export function applyFaviconToDom(url?: string) {
  if (typeof document === 'undefined') return
  const href = resolveFaviconUrl(url ?? BRAND_FAVICON_URL)
  try {
    const next = new URL(href, window.location.href).href
    const existingIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (
      existingIcon?.href === next &&
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
      ).length >= 2
    ) {
      return
    }
    document
      .querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
      )
      .forEach((el) => el.remove())
    upsertFaviconLink('icon', href, 'image/png')
    upsertFaviconLink('shortcut icon', href, 'image/png')
    upsertFaviconLink('apple-touch-icon', BRAND_APPLE_TOUCH_ICON_URL)
  } catch {
    // Ignore malformed URLs
  }
}
