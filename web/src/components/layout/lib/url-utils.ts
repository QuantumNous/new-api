import type { NavItem, NavCollapsible } from '../types'

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
  // For collapsible items (NavCollapsible), check sub-items first
  if ('items' in item && item.items) {
    const collapsibleItem = item as NavCollapsible
    const items = collapsibleItem.items
    const hrefWithoutQuery = href.split('?')[0]
    const hrefHasQuery = href.includes('?')
    
    // Check if any sub-item matches
    if (
      items.some((i) => {
        if (!i?.url) return false
        if (href === i.url) return true
        const subItemUrlWithoutQuery = i.url.split('?')[0]
        const subItemUrlHasQuery = i.url.includes('?')
        if (subItemUrlWithoutQuery === hrefWithoutQuery) {
          // If sub-item URL has no query params, only match if href also has no query params
          if (!subItemUrlHasQuery && !hrefHasQuery) return true
          // If sub-item URL has query params, they must match exactly
          if (subItemUrlHasQuery && href === i.url) return true
        }
        return false
      })
    )
      return true
  }

  // For regular link items, check the item's URL
  if (!item.url) return false

  // Exact match
  if (href === item.url) return true

  const hrefWithoutQuery = href.split('?')[0]
  const itemUrlWithoutQuery = item.url.split('?')[0]
  const hrefHasQuery = href.includes('?')
  const itemUrlHasQuery = item.url.includes('?')

  // If both URLs have the same base path
  if (hrefWithoutQuery === itemUrlWithoutQuery) {
    // If item.url has no query params, only match if href also has no query params
    // This prevents /system-settings/auth from matching /system-settings/auth?section=xxx
    if (!itemUrlHasQuery && !hrefHasQuery) return true
    // If item.url has query params, they must match exactly
    if (itemUrlHasQuery && href === item.url) return true
  }

  // Main navigation match (matches first-level path)
  if (mainNav && href.split('/')[1] && item.url) {
    const hrefFirstPath = href.split('/')[1]
    const itemFirstPath = item.url.split('/')[1]
    return hrefFirstPath === itemFirstPath
  }

  return false
}
