import type { LinkProps } from '@tanstack/react-router'
import type { NavItem, NavCollapsible } from '../types'

/**
 * Convert LinkProps['to'] to string
 * Handles both string URLs and object URLs (e.g., { pathname, search })
 */
function urlToString(url: LinkProps['to'] | (string & {})): string | null {
  if (typeof url === 'string') {
    return url
  }
  if (url && typeof url === 'object' && !Array.isArray(url)) {
    // Handle object URLs like { pathname: string, search?: string }
    const urlObj = url as Record<string, unknown>
    const pathname = typeof urlObj.pathname === 'string' ? urlObj.pathname : ''
    const search = typeof urlObj.search === 'string' ? urlObj.search : ''
    return pathname + search
  }
  return null
}

/**
 * Normalize URL by removing query parameters and trailing slashes
 */
export function normalizeHref(href: string): string {
  const withoutQuery = href.split('?')[0]
  return withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, '')
    : withoutQuery
}

/**
 * Check if a navigation item is active
 * @param href - Current URL
 * @param item - Navigation item
 * @param mainNav - Whether this is a main navigation item (matches first-level path)
 */
export function checkIsActive(
  href: string,
  item: NavItem,
  mainNav = false
): boolean {
  const hrefWithoutQuery = href.split('?')[0]

  if (item.activeUrls?.some((url) => urlToString(url) === hrefWithoutQuery)) {
    return true
  }

  // For collapsible items (NavCollapsible), check sub-items first
  if ('items' in item && item.items) {
    const collapsibleItem = item as NavCollapsible
    const items = collapsibleItem.items

    // Check if any sub-item matches
    if (
      items.some((i) => {
        if (!i?.url) return false
        const subItemUrl = urlToString(i.url)
        if (!subItemUrl) return false
        if (href === subItemUrl) return true
        const subItemUrlWithoutQuery = subItemUrl.split('?')[0]
        const subItemUrlHasQuery = subItemUrl.includes('?')
        if (subItemUrlWithoutQuery === hrefWithoutQuery) {
          // If sub-item URL has no query params, pathname match is enough (href may have query params)
          if (!subItemUrlHasQuery) return true
          // If sub-item URL has query params, they must match exactly
          if (subItemUrlHasQuery && href === subItemUrl) return true
        }
        return false
      })
    )
      return true
  }

  // For regular link items, check the item's URL
  if (!item.url) return false

  const itemUrl = urlToString(item.url)
  if (!itemUrl) return false

  // Exact match
  if (href === itemUrl) return true

  const itemUrlWithoutQuery = itemUrl.split('?')[0]
  const itemUrlHasQuery = itemUrl.includes('?')

  // If both URLs have the same base path
  if (hrefWithoutQuery === itemUrlWithoutQuery) {
    // If item.url has no query params, pathname match is enough (current URL may have query params)
    if (!itemUrlHasQuery) return true
    // If item.url has query params, they must match exactly
    if (itemUrlHasQuery && href === itemUrl) return true
  }

  // Main navigation match (matches first-level path)
  if (mainNav && href.split('/')[1] && itemUrl) {
    const hrefFirstPath = href.split('/')[1]
    const itemFirstPath = itemUrl.split('/')[1]
    return hrefFirstPath === itemFirstPath
  }

  return false
}
