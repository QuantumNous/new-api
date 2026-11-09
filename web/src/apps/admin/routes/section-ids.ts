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
 * Section identifiers for the admin console, kept free of imports on purpose.
 *
 * Route config modules (`createFileRoute` options, `beforeLoad`) are part of the
 * initial entry chunk, so anything they import is downloaded by every visitor,
 * including the client portal. Importing a section registry here would pull the
 * whole settings feature graph — and its admin-only API modules — into that
 * entry chunk. This module must stay dependency-free; `./__tests__/section-ids`
 * asserts it stays in sync with the registries.
 */

export const MODELS_PAGE_SECTION_IDS = [
  'metadata',
  'vendors',
  'deployments',
] as const
export const MODELS_PAGE_DEFAULT_SECTION = 'metadata'

export const SETTINGS_AUTH_SECTION_IDS = [
  'basic-auth',
  'oauth',
  'passkey',
  'bot-protection',
  'custom-oauth',
] as const
export const SETTINGS_AUTH_DEFAULT_SECTION = 'basic-auth'

export const SETTINGS_BILLING_SECTION_IDS = [
  'quota',
  'currency',
  'model-pricing',
  'group-pricing',
  'payment',
  'checkin',
] as const
export const SETTINGS_BILLING_DEFAULT_SECTION = 'quota'

export const SETTINGS_CONTENT_SECTION_IDS = [
  'dashboard',
  'announcements',
  'api-info',
  'faq',
  'uptime-kuma',
  'chat',
  'drawing',
] as const
export const SETTINGS_CONTENT_DEFAULT_SECTION = 'dashboard'

export const SETTINGS_MODELS_SECTION_IDS = [
  'global',
  'gemini',
  'claude',
  'grok',
  'model-deployment',
] as const
export const SETTINGS_MODELS_DEFAULT_SECTION = 'global'

export const SETTINGS_OPERATIONS_SECTION_IDS = [
  'behavior',
  'alerts',
  'email',
  'worker',
  'logs',
  'performance',
  'update-checker',
] as const
export const SETTINGS_OPERATIONS_DEFAULT_SECTION = 'behavior'

export const SETTINGS_SECURITY_SECTION_IDS = [
  'rate-limit',
  'ssrf',
  'token-limits',
] as const
export const SETTINGS_SECURITY_DEFAULT_SECTION = 'rate-limit'

export const SETTINGS_SITE_SECTION_IDS = [
  'system-info',
  'notice',
  'header-navigation',
  'sidebar-modules',
] as const
export const SETTINGS_SITE_DEFAULT_SECTION = 'system-info'

export const POLICY_SECTION_IDS = ['filtering', 'routing', 'health'] as const
export const POLICY_DEFAULT_SECTION = 'routing'
