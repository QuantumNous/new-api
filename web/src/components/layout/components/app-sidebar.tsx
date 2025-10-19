import { useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarConfig } from '../config/sidebar.config'
import { getNavGroupsForPath } from '../utils/workspace-registry'
import { NavGroup } from './nav-group'
import { WorkspaceSwitcher } from './workspace-switcher'

/**
 * 应用侧边栏组件
 * 根据当前路径从工作区注册表获取对应的导航菜单
 *
 * 通过工作区注册表系统自动匹配当前路径对应的工作区配置
 * 添加新工作区只需在 workspace-registry.ts 中注册即可
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { pathname } = useLocation()
  const userRole = useAuthStore((state) => state.auth.user?.role)

  // 从工作区注册表获取当前路径对应的导航组配置
  const allNavGroups = getNavGroupsForPath(pathname)

  // 根据用户角色过滤导航组
  // 非 Admin 用户不显示 Admin 导航组
  const currentNavGroups = useMemo(() => {
    const isAdmin = userRole && userRole >= ROLE.ADMIN
    return allNavGroups.filter((group) => {
      if (group.title === 'Admin') {
        return isAdmin
      }
      return true
    })
  }, [allNavGroups, userRole])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <WorkspaceSwitcher workspaces={sidebarConfig.workspaces} />
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
