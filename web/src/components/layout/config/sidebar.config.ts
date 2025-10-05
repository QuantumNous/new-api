import {
  LayoutDashboard,
  Key,
  FileText,
  Wallet,
  Box,
  Server,
  Users,
  Ticket,
  Settings,
  User,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

/**
 * 侧边栏配置
 * - workspaces: 工作区列表，第一个为默认工作区（动态获取系统信息）
 * - navGroups: 侧边栏导航组
 */
export const sidebarConfig: SidebarData = {
  workspaces: [
    {
      name: '', // 动态获取系统名称
      logo: Command,
      plan: '', // 动态获取系统版本
    },
    {
      name: 'System Settings',
      logo: Settings,
      plan: 'Manage and configure',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'API Keys',
          url: '/keys',
          icon: Key,
        },
        {
          title: 'Usage Logs',
          url: '/usage-logs',
          icon: FileText,
        },
        {
          title: 'Wallet',
          url: '/wallet',
          icon: Wallet,
        },
        {
          title: 'Profile',
          url: '/profile',
          icon: User,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          title: 'Models',
          url: '/models',
          icon: Box,
        },
        {
          title: 'Providers',
          url: '/providers',
          icon: Server,
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Redemption Codes',
          url: '/redemption-codes',
          icon: Ticket,
        },
      ],
    },
  ],
}
