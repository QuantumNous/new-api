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
import { type TFunction } from 'i18next'
import {
  Activity,
  Box,
  CalendarRange,
  Cpu,
  CreditCard,
  FileText,
  FlaskConical,
  HeartPulse,
  Images,
  Key,
  LayoutDashboard,
  ListTodo,
  MailCheck,
  Radio,
  Rocket,
  Settings,
  ShieldAlert,
  Ticket,
  User,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { type SidebarData } from '@/components/layout/types'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function buildSidebarData(
  t: TFunction,
  options?: { inviteBadge?: string }
): SidebarData {
  return {
    navGroups: [
      {
        id: 'chat',
        title: t('Get Started'),
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
          },
        ],
      },
      {
        id: 'general',
        title: t('Models'),
        items: [
          {
            title: t('Available Models'),
            url: '/available-models',
            icon: Box,
          },
          {
            title: t('Usage Logs'),
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
          {
            title: t('Analytics'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
        ],
      },
      {
        id: 'tools',
        title: t('Tools'),
        items: [
          {
            title: t('Get Started'),
            url: '/quickstart',
            icon: Rocket,
          },
          {
            title: t('Tool Marketplace'),
            url: '/api-marketplace',
            icon: Wrench,
          },
        ],
      },
      {
        id: 'credentials',
        title: t('Credentials'),
        items: [
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Invite'),
            url: '/invite',
            icon: UserPlus,
            badge: options?.inviteBadge ?? t('Earn More Credits!'),
            badgeVariant: 'promotion',
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
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
            title: t('Compute Nodes'),
            url: '/compute/nodes',
            icon: Cpu,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Model Health'),
            url: '/model-health',
            icon: HeartPulse,
          },
          {
            title: t('Codex model governance'),
            url: '/codex-model-governance',
            icon: ShieldAlert,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Ops Daily Report'),
            url: '/ops-report',
            icon: CalendarRange,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Prompt Gallery'),
            url: '/prompt-gallery',
            icon: Images,
          },
          {
            title: t('Subscription Management'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('Activity Configuration'),
            url: '/recall-campaigns',
            icon: MailCheck,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}

export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const badgeUsd = useSystemConfigStore(
    (state) => state.config.inviteRewardBadgeUsd
  )
  // Direct money stimulus beats prose: show "+$50" when the reward amount is
  // known, fall back to the generic promo text otherwise.
  const inviteBadge =
    badgeUsd && badgeUsd > 0 ? `+$${Math.round(badgeUsd)}` : undefined

  return buildSidebarData(t, { inviteBadge })
}
