import { type LinkProps } from '@tanstack/react-router'

/**
 * Workspace type
 * Used for top switcher to display different workspaces
 */
export type Workspace = {
  id: string
  name: string
  logo: React.ElementType
  plan: string
}

/**
 * Base navigation item type
 */
type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  activeUrls?: (LinkProps['to'] | (string & {}))[]
  configUrls?: (LinkProps['to'] | (string & {}))[]
}

/**
 * Navigation link type - single link item
 */
export type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
  type?: never
}

/**
 * Navigation collapsible type - collapsible navigation with sub-items
 */
export type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
  type?: never
}

/**
 * Dynamic chat presets type - dynamically loaded chat preset list from API
 */
export type NavChatPresets = BaseNavItem & {
  type: 'chat-presets'
  url?: never
  items?: never
}

/**
 * Navigation item union type
 */
export type NavItem = NavCollapsible | NavLink | NavChatPresets

/**
 * Navigation group type - a group of navigation items in sidebar
 */
export type NavGroup = {
  id?: string
  title: string
  items: NavItem[]
}

/**
 * Sidebar data type
 */
export type SidebarData = {
  workspaces: Workspace[]
  navGroups: NavGroup[]
}

/**
 * Top navigation link type
 */
export type TopNavLink = {
  title: string
  href: string
  isActive?: boolean
  disabled?: boolean
  external?: boolean
}
