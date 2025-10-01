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
  UserCog,
  Wrench,
  Palette,
  Bell,
  Monitor,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
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
          title: 'Logs',
          url: '/logs',
          icon: FileText,
        },
        {
          title: 'Wallet',
          url: '/wallet',
          icon: Wallet,
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
        {
          title: 'Settings',
          icon: Settings,
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
      ],
    },
  ],
}
