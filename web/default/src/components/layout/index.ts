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
export { PageFooterPortal } from './components/page-footer'
export { NavGroup } from './components/nav-group'
export { SectionPageLayout } from './components/section-page-layout'
export { SystemBrand } from './components/system-brand'
export { TopNav } from './components/top-nav'
export { MobileDrawer } from './components/mobile-drawer'

// 上下文
export { WorkspaceProvider, useWorkspace } from './context/workspace-context'

// 配置
export {
  getSystemSettingsNavGroups,
  WORKSPACE_SYSTEM_SETTINGS_ID,
} from './config/system-settings.config'
export { defaultTopNavLinks } from './config/top-nav.config'

// 常量
export { MOBILE_DRAWER_ANIMATION, MOBILE_DRAWER_CONFIG } from './constants'

// 工具函数 - 工作区注册表
export {
  getWorkspaceByPath,
  getNavGroupsForPath,
  isInWorkspace,
  getAllWorkspaces,
  WORKSPACE_IDS,
} from './lib/workspace-registry'

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
export type { WorkspaceConfig, WorkspaceId } from './lib/workspace-registry'
export type { SectionPageLayoutProps } from './components/section-page-layout'
