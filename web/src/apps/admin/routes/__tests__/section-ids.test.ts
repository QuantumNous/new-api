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
import { describe, expect, it } from 'vitest'

import { MODELS_SECTION_IDS } from '@/apps/admin/features/models/section-registry'
import { AUTH_SECTION_IDS } from '@/apps/admin/features/system-settings/auth/section-registry'
import { BILLING_SECTION_IDS } from '@/apps/admin/features/system-settings/billing/section-registry'
import { CONTENT_SECTION_IDS } from '@/apps/admin/features/system-settings/content/section-registry'
import { MODELS_SECTION_IDS as SETTINGS_MODELS_IDS } from '@/apps/admin/features/system-settings/models/section-registry'
import { OPERATIONS_SECTION_IDS } from '@/apps/admin/features/system-settings/operations/section-registry'
import { POLICY_SECTION_IDS } from '@/apps/admin/features/system-settings/request-policies/section-registry'
import { SECURITY_SECTION_IDS } from '@/apps/admin/features/system-settings/security/section-registry'
import { SITE_SECTION_IDS } from '@/apps/admin/features/system-settings/site/section-registry'
import {
  MODELS_PAGE_SECTION_IDS,
  POLICY_SECTION_IDS as ROUTE_POLICY_SECTION_IDS,
  SETTINGS_AUTH_SECTION_IDS,
  SETTINGS_BILLING_SECTION_IDS,
  SETTINGS_CONTENT_SECTION_IDS,
  SETTINGS_MODELS_SECTION_IDS,
  SETTINGS_OPERATIONS_SECTION_IDS,
  SETTINGS_SECURITY_SECTION_IDS,
  SETTINGS_SITE_SECTION_IDS,
} from '../section-ids'

/**
 * Route configs read section ids from `../section-ids`, which has no imports.
 * The registries remain the implementation source of truth, so this test fails
 * the moment a section is added or renamed on only one side.
 */
describe('admin route section ids', () => {
  it.each([
    ['models page', MODELS_PAGE_SECTION_IDS, MODELS_SECTION_IDS],
    ['settings auth', SETTINGS_AUTH_SECTION_IDS, AUTH_SECTION_IDS],
    ['settings billing', SETTINGS_BILLING_SECTION_IDS, BILLING_SECTION_IDS],
    ['settings content', SETTINGS_CONTENT_SECTION_IDS, CONTENT_SECTION_IDS],
    [
      'settings models',
      SETTINGS_MODELS_SECTION_IDS,
      SETTINGS_MODELS_IDS,
    ],
    [
      'settings operations',
      SETTINGS_OPERATIONS_SECTION_IDS,
      OPERATIONS_SECTION_IDS,
    ],
    ['settings security', SETTINGS_SECURITY_SECTION_IDS, SECURITY_SECTION_IDS],
    ['settings site', SETTINGS_SITE_SECTION_IDS, SITE_SECTION_IDS],
    ['request policies', ROUTE_POLICY_SECTION_IDS, POLICY_SECTION_IDS],
  ])('%s match its registry', (_name, routeIds, registryIds) => {
    expect([...routeIds]).toEqual([...registryIds])
  })
})
