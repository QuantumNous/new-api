/**
 * Layout 组件统一导出
 */

// 核心组件
export { AppHeader } from './components/app-header'
export { AppSidebar } from './components/app-sidebar'
export { AuthenticatedLayout } from './components/authenticated-layout'
export { Header } from './components/header'
export { Main } from './components/main'
export { NavGroup } from './components/nav-group'
export { TeamSwitcher } from './components/team-switcher'
export { TopNav } from './components/top-nav'

// 上下文
export { WorkspaceProvider, useWorkspace } from './context/workspace-context'

// 配置
export { sidebarConfig } from './config/sidebar.config'
export { systemSettingsConfig } from './config/system-settings.config'
export { defaultTopNavLinks } from './config/top-nav.config'

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
