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
 * 工作区注册表使用示例
 *
 * 本文件展示如何添加新工作区，仅作示例参考，不会被编译
 */

/**
 * 步骤1: 创建工作区的侧边栏配置文件
 * 例如：web/src/components/layout/config/user-management.config.ts
 */
/*
import { Users, UserPlus, Shield } from 'lucide-react'
import { type NavGroup } from '../types'

export const userManagementConfig: NavGroup[] = [
  {
    title: 'User Management',
    items: [
      {
        title: 'All Users',
        url: '/user-management/list',
        icon: Users,
      },
      {
        title: 'Create User',
        url: '/user-management/create',
        icon: UserPlus,
      },
      {
        title: 'Permissions',
        url: '/user-management/permissions',
        icon: Shield,
      },
    ],
  },
]
*/

/**
 * 步骤2: 在 workspace-registry.ts 中注册新工作区
 * 在 workspaceRegistry 数组中添加配置（在默认工作区之前）
 */
/*
import { userManagementConfig } from '../config/user-management.config'

const workspaceRegistry: WorkspaceConfig[] = [
  // System Settings 工作区
  {
    name: 'System Settings',
    pathPattern: /^\/system-settings/,
    navGroups: systemSettingsConfig,
  },
  // 新增的 User Management 工作区
  {
    name: 'User Management',
    pathPattern: /^\/user-management/,  // 或使用字符串: '/user-management'
    navGroups: userManagementConfig,
  },
  // 默认工作区（必须放在最后）
  {
    name: 'Default',
    pathPattern: /.* /,
    navGroups: sidebarConfig.navGroups,
  },
]
*/

/**
 * 步骤3: （可选）在 sidebar.config.ts 中添加工作区到切换器
 */
/*
export const sidebarConfig: SidebarData = {
  workspaces: [
    {
      name: '',
      logo: Command,
      plan: '',
    },
    {
      name: 'User Management',
      logo: Users,
      plan: 'Manage users',
    },
    {
      name: 'System Settings',
      logo: Settings,
      plan: 'Manage and configure',
    },
  ],
  navGroups: [...],
}
*/

/**
 * 同语注：这里就完成了，现在：
 * - 侧边栏会根据当前路径自动切换显示对应的工作区菜单
 * - 搜索功能会自动显示当前工作区的菜单项
 * - 工作区切换器会显示新的工作区选项
 *
 * 无需修改任何其他文件！
 */
