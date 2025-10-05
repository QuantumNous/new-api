import { type LinkProps } from '@tanstack/react-router'

/**
 * Workspace 工作区类型
 * 用于顶部切换器显示不同的工作空间
 */
export type Workspace = {
  name: string
  logo: React.ElementType
  plan: string
}

/**
 * 导航项基础类型
 */
type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
}

/**
 * 导航链接类型 - 单个链接项
 */
export type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

/**
 * 导航折叠类型 - 包含子项的可折叠导航
 */
export type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

/**
 * 导航项联合类型
 */
export type NavItem = NavCollapsible | NavLink

/**
 * 导航组类型 - 侧边栏中的一组导航项
 */
export type NavGroup = {
  title: string
  items: NavItem[]
}

/**
 * 侧边栏数据类型
 */
export type SidebarData = {
  workspaces: Workspace[]
  navGroups: NavGroup[]
}

/**
 * 顶部导航链接类型
 */
export type TopNavLink = {
  title: string
  href: string
  isActive?: boolean
  disabled?: boolean
  external?: boolean
}
