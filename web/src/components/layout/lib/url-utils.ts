import type { NavItem } from '../types'

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
  // Exact match
  if (href === item.url) return true

  // Match ignoring query parameters
  if (href.split('?')[0] === item.url) return true

  // Sub-item is active
  if (item.items?.some((i) => i.url === href)) return true

  // Main navigation match (matches first-level path)
  if (mainNav && href.split('/')[1] && item.url) {
    const hrefFirstPath = href.split('/')[1]
    const itemFirstPath = item.url.split('/')[1]
    return hrefFirstPath === itemFirstPath
  }

  return false
}
