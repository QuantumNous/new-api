import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarConfig } from '../config/sidebar.config'
import { systemSettingsConfig } from '../config/system-settings.config'
import { useWorkspace } from '../context/workspace-context'
import { NavGroup } from './nav-group'
import { TeamSwitcher } from './team-switcher'

/**
 * 应用侧边栏组件
 * 根据当前激活的工作区显示不同的导航菜单
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { activeWorkspace } = useWorkspace()

  // 根据激活的工作区选择对应的侧边栏配置
  const currentNavGroups =
    activeWorkspace?.name === 'System Settings'
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
