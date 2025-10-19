/**
 * Layout 组件统一导出
 */

// 核心组件
export { AppHeader } from './components/app-header'
export { AppSidebar } from './components/app-sidebar'
export { AuthenticatedLayout } from './components/authenticated-layout'
export { PublicLayout } from './components/public-layout'
export { PublicHeader } from './components/public-header'
export { PublicNavigation } from './components/public-navigation'
export { HeaderLogo } from './components/header-logo'
export { NavLinkItem, NavLinkList } from './components/nav-link-item'
export { Header } from './components/header'
export { Main } from './components/main'
export { NavGroup } from './components/nav-group'
export { WorkspaceSwitcher } from './components/workspace-switcher'
export { TopNav } from './components/top-nav'

// 上下文
export { WorkspaceProvider, useWorkspace } from './context/workspace-context'

// 配置
export { sidebarConfig } from './config/sidebar.config'
export { systemSettingsConfig } from './config/system-settings.config'
export { defaultTopNavLinks } from './config/top-nav.config'

// 工具函数 - 工作区注册表
export {
  getWorkspaceByPath,
  getNavGroupsForPath,
  isInWorkspace,
  getAllWorkspaces,
} from './utils/workspace-registry'

// 类型导出（使用 type-only 导出避免与组件冲突）
export type {
  Workspace,
  NavLink,
  NavCollapsible,
  NavItem,
  NavGroup as NavGroupType,
  SidebarData,
  TopNavLink,
} from './types'
export type { WorkspaceConfig } from './utils/workspace-registry'
