import { type TopNavLink } from '../types'

/**
 * Default top navigation links
 *
 * In practice, navigation links are dynamically fetched from backend.
 * Priority: Backend dynamic links > Provided navLinks > defaultTopNavLinks
 *
 * This is intentionally empty to encourage backend configuration.
 * If you need fallback links, add them here.
 */
export const defaultTopNavLinks: TopNavLink[] = []
