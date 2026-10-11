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
import { z } from 'zod'

import { isUploadedSupportIcon } from '@/features/support/types'

export const FOOTER_SOCIAL_ICON_OPTIONS = [
  'github',
  'documentation',
  'discord',
  'telegram',
  'email',
] as const

export type FooterSocialIconName = (typeof FOOTER_SOCIAL_ICON_OPTIONS)[number]

const footerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)

export function isFooterLinkUrl(value: string): boolean {
  if (
    !value ||
    value !== value.trim() ||
    value.length > 500 ||
    /[\r\n\\]/.test(value)
  ) {
    return false
  }
  if (value.startsWith('/')) return !value.startsWith('//')

  try {
    const url = new URL(value)
    if (url.protocol === 'mailto:') return url.pathname !== ''
    return ['http:', 'https:'].includes(url.protocol) && url.host !== ''
  } catch {
    return false
  }
}

export const footerLinkSchema = z.object({
  id: footerIdSchema,
  label: z.string().trim().min(1).max(80),
  url: z.string().refine(isFooterLinkUrl),
})

export const footerSocialLinkSchema = footerLinkSchema.extend({
  icon: z.enum(FOOTER_SOCIAL_ICON_OPTIONS),
})

export const footerColumnSchema = z.object({
  id: footerIdSchema,
  title: z.string().trim().min(1).max(80),
  links: z.array(footerLinkSchema).max(10),
})

export const footerRegistrationSchema = footerLinkSchema.extend({
  url: z.string().refine((value) => {
    if (!isFooterLinkUrl(value)) return false
    try {
      const url = new URL(value)
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  }),
  icon: z
    .string()
    .refine((value) => value === '' || isUploadedSupportIcon(value)),
})
export type FooterRegistration = z.infer<typeof footerRegistrationSchema>

export const footerConfigSchema = z.object({
  registrations: z.array(footerRegistrationSchema).max(10).optional(),
  description: z.string().max(240),
  socialLinks: z.array(footerSocialLinkSchema).max(8),
  columns: z.array(footerColumnSchema).max(6),
})

export type FooterLink = z.infer<typeof footerLinkSchema>
export type FooterSocialLink = z.infer<typeof footerSocialLinkSchema>
export type FooterColumn = z.infer<typeof footerColumnSchema>
export type FooterConfig = z.infer<typeof footerConfigSchema>

export function parseFooterConfig(value: unknown): FooterConfig | null {
  let parsed = value
  if (typeof value === 'string') {
    if (!value.trim()) return null
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }

  const result = footerConfigSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export function createDefaultFooterConfig(): FooterConfig {
  return {
    description: 'Powerful API Management Platform',
    socialLinks: [
      {
        id: 'github',
        label: 'GitHub',
        url: 'https://github.com/QuantumNous/new-api',
        icon: 'github',
      },
      {
        id: 'documentation',
        label: 'Documentation',
        url: 'https://docs.newapi.pro',
        icon: 'documentation',
      },
      {
        id: 'discord',
        label: 'Discord',
        url: 'https://docs.newapi.pro/support/community-interaction/',
        icon: 'discord',
      },
      {
        id: 'telegram',
        label: 'Telegram',
        url: 'https://docs.newapi.pro/support/community-interaction/',
        icon: 'telegram',
      },
      {
        id: 'email',
        label: 'Email',
        url: 'mailto:support@quantumnous.com',
        icon: 'email',
      },
    ],
    columns: [
      {
        id: 'product',
        title: 'Product',
        links: [
          { id: 'capabilities', label: 'Capabilities', url: '/#platform' },
          { id: 'models', label: 'Models', url: '/#models' },
          { id: 'playground', label: 'Playground', url: '/playground' },
          { id: 'wallet', label: 'Wallet', url: '/wallet' },
        ],
      },
      {
        id: 'documentation',
        title: 'Documentation',
        links: [
          {
            id: 'quick-start',
            label: 'Quick Start',
            url: 'https://docs.newapi.pro/getting-started/',
          },
          {
            id: 'api-documentation',
            label: 'API Documentation',
            url: 'https://docs.newapi.pro/api/',
          },
          { id: 'model-pricing', label: 'Model pricing', url: '/pricing' },
        ],
      },
      {
        id: 'resources',
        title: 'Resources',
        links: [
          {
            id: 'project-introduction',
            label: 'Project introduction',
            url: 'https://docs.newapi.pro/wiki/project-introduction/',
          },
          {
            id: 'deployment',
            label: 'Deployment',
            url: 'https://docs.newapi.pro/installation/',
          },
          {
            id: 'key-tool',
            label: 'Key tool',
            url: 'https://github.com/Calcium-Ion/new-api-key-tool',
          },
        ],
      },
      {
        id: 'community',
        title: 'Community',
        links: [
          {
            id: 'github-repository',
            label: 'GitHub repository',
            url: 'https://github.com/QuantumNous/new-api',
          },
          {
            id: 'issues',
            label: 'Issues',
            url: 'https://github.com/QuantumNous/new-api/issues',
          },
          {
            id: 'community-channels',
            label: 'Community channels',
            url: 'https://docs.newapi.pro/support/community-interaction/',
          },
        ],
      },
    ],
  }
}
