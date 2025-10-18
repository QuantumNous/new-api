import { useLocation } from '@tanstack/react-router'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarConfig } from '../config/sidebar.config'
import { systemSettingsConfig } from '../config/system-settings.config'
import { isSystemSettingsPath } from '../utils/workspace-detector'
import { NavGroup } from './nav-group'
import { TeamSwitcher } from './team-switcher'

/**
 * 应用侧边栏组件
 * 根据当前激活的工作区显示不同的导航菜单
 *
 * 状态来源优先级：
 * 1. 从 URL 路径检测（主要方式，确保页面刷新时一致）
 * 2. 从 activeWorkspace context 检测（备选方式，用于用户主动切换工作区）
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { pathname } = useLocation()

  // 优先从 URL 检测工作区，确保页面刷新时能正确显示
  // 如果 URL 显示在 System Settings，则显示 System Settings 导航
  // 否则显示主工作区导航
  const isSystemSettings = isSystemSettingsPath(pathname)

  const currentNavGroups = isSystemSettings
    ? systemSettingsConfig
    : sidebarConfig.navGroups

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher workspaces={sidebarConfig.workspaces} />
      </SidebarHeader>
      <SidebarContent>
        {currentNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
