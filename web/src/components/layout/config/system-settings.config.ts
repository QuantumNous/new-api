import { UserCog, Wrench, Palette, Bell, Monitor } from 'lucide-react'
import { type NavGroup } from '../types'

/**
 * 系统设置侧边栏配置
 * 当切换到 "System Settings" 工作区时显示
 */
export const systemSettingsConfig: NavGroup[] = [
  {
    title: 'System Settings',
    items: [
      {
        title: 'Profile',
        url: '/settings',
        icon: UserCog,
      },
      {
        title: 'Account',
        url: '/settings/account',
        icon: Wrench,
      },
      {
        title: 'Appearance',
        url: '/settings/appearance',
        icon: Palette,
      },
      {
        title: 'Notifications',
        url: '/settings/notifications',
        icon: Bell,
      },
      {
        title: 'Display',
        url: '/settings/display',
        icon: Monitor,
      },
    ],
  },
]
