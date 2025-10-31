import {
  LayoutDashboard,
  Key,
  FileText,
  Wallet,
  Box,
  Users,
  Ticket,
  Settings,
  User,
  Command,
  Radio,
  FlaskConical,
  MessageSquare,
} from 'lucide-react'
import { type SidebarData } from '../types'

/**
 * Sidebar configuration
 * - workspaces: List of workspaces, first one is default workspace (dynamically fetches system info)
 * - navGroups: Sidebar navigation groups (includes all navigation items, including Chat)
 */
export const sidebarConfig: SidebarData = {
  workspaces: [
    {
      name: '', // Dynamically fetches system name
      logo: Command,
      plan: '', // Dynamically fetches system version
    },
    {
      name: 'System Settings',
      logo: Settings,
      plan: 'Manage and configure',
    },
  ],
  navGroups: [
    {
      title: 'Chat',
      items: [
        {
          title: 'Playground',
          url: '/playground',
          icon: FlaskConical,
        },
        {
          title: 'Chat',
          icon: MessageSquare,
          type: 'chat-presets',
        },
      ],
    },
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
          title: 'Channels',
          url: '/channels',
          icon: Radio,
        },
        {
          title: 'Models',
          url: '/models',
          icon: Box,
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
