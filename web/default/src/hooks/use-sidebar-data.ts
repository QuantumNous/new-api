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
  Wallet,
  Box,
  Users,
  Ticket,
  User,
  Command,
  Radio,
  FlaskConical,
  MessageSquare,
  CreditCard,
  ListTodo,
  Settings,
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
      {
        id: 'chat',
        title: t('Chat'),
        items: [
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'general',
        title: t('Operations Console'),
        items: [
          {
            title: t('Operations Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Model Call Analytics'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('Application Access Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Token Consumption Details'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Audit Records'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/task', '/usage-logs/drawing'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal Center'),
        items: [
          {
            title: t('Token Quota Management'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Account Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Platform Administration'),
        items: [
          {
            title: t('Model Service Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Model Resource Pool'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Tenant & Account Management'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Resource Redemption Management'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscription Plan Management'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('Platform Configuration Center'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}
