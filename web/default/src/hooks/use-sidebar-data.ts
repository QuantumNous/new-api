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
import {
  LayoutDashboard,
  Activity,
  Key,
  FileText,
  Home,
  Wallet,
  Box,
  Users,
  Ticket,
  User,
  Command,
  Radio,
  // MessageSquare,  // un-comment when restoring chat-presets dropdown
  CreditCard,
  ListTodo,
  Settings,
  HelpCircle,
  Store,
  Sparkles,
  LibraryBig,
  BarChart2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WORKSPACE_IDS } from '@/components/layout/lib/workspace-registry'
import { type SidebarData } from '@/components/layout/types'

export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    workspaces: [
      {
        id: WORKSPACE_IDS.DEFAULT,
        name: '', // Dynamically fetches system name
        logo: Command,
        plan: '', // Dynamically fetches system version
      },
    ],
    navGroups: [
      // DeepRouter: the "Chat / Playground" nav group is removed — the
      // playground is a developer console inherited from upstream new-api
      // and end users never use it ("不做 chat 是红线"). /playground itself
      // redirects to the dashboard. Re-add a group here if a developer-mode
      // playground is ever reintroduced.
      {
        id: 'general',
        title: t('General'),
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Call history'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Home'),
            url: '/home',
            icon: Home,
          },
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'marketplace',
        title: t('Marketplace'),
        items: [
          {
            title: t('Skills'),
            url: '/skills',
            icon: Store,
          },
          {
            title: t('My Skills'),
            url: '/skills/my',
            icon: Sparkles,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Admin Skills'),
            url: '/skills/admin',
            icon: LibraryBig,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscription Management'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
          // DR-76: Ops Overview dashboard — skill health metrics for operators.
          {
            title: t('Skill Analytics'),
            url: '/skill-analytics',
            icon: BarChart2,
          },
          // DeepRouter cheatsheet — keeps the Channel/Model/Group pricing
          // relationship a click away so the operator never has to re-derive
          // the quota formula from memory.
          {
            title: t('Pricing Cheatsheet'),
            url: '/help/pricing',
            icon: HelpCircle,
          },
        ],
      },
    ],
  }
}
