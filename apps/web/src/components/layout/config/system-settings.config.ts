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
  Box,
  CreditCard,
  Layout,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
} from 'lucide-react'

import { getAuthSectionNavItems } from '@/features/system-settings/auth/section-registry.tsx'
import { getBillingSectionNavItems } from '@/features/system-settings/billing/section-registry.tsx'
import { getContentSectionNavItems } from '@/features/system-settings/content/section-registry.tsx'
import { getModelsSectionNavItems } from '@/features/system-settings/models/section-registry.tsx'
import { getOperationsSectionNavItems } from '@/features/system-settings/operations/section-registry.tsx'
import { getSecuritySectionNavItems } from '@/features/system-settings/security/section-registry.tsx'
import { getSiteSectionNavItems } from '@/features/system-settings/site/section-registry.tsx'

import type { NavCollapsible } from '../types'

/**
 * Theme-level System Settings collapsibles exposed directly under the
 * Admin Tab. Each entry groups one logical domain (Site & Branding,
 * Authentication, Billing & Payment, Models & Routing, Security & Limits,
 * Console Content, Operations) and lists its leaf sections produced by
 * the per-domain `section-registry.tsx` `getSectionNavItems` helpers.
 *
 * Reused by both the Admin Tab sidebar and the command palette so the
 * sidebar and the `/system-settings` index stay aligned without
 * duplicating labels.
 */
export function getSystemSettingsThemeNavItems(t: TFunction): NavCollapsible[] {
  return [
    {
      title: t('Site & Branding'),
      icon: Settings,
      activeUrls: ['/system-settings/site'],
      items: getSiteSectionNavItems(t),
    },
    {
      title: t('Authentication'),
      icon: Shield,
      activeUrls: ['/system-settings/auth'],
      items: getAuthSectionNavItems(t),
    },
    {
      title: t('Billing & Payment'),
      icon: CreditCard,
      activeUrls: ['/system-settings/billing'],
      items: getBillingSectionNavItems(t),
    },
    {
      title: t('Models & Routing'),
      icon: Box,
      activeUrls: ['/system-settings/models'],
      items: getModelsSectionNavItems(t),
    },
    {
      title: t('Security & Limits'),
      icon: ShieldAlert,
      activeUrls: ['/system-settings/security'],
      items: getSecuritySectionNavItems(t),
    },
    {
      title: t('Console Content'),
      icon: Layout,
      activeUrls: ['/system-settings/content'],
      items: getContentSectionNavItems(t),
    },
    {
      title: t('Operations'),
      icon: Wrench,
      activeUrls: ['/system-settings/operations'],
      items: getOperationsSectionNavItems(t),
    },
  ]
}
