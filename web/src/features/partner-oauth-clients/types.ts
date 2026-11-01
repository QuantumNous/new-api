/*
Copyright (C) 2023-2026 QuantumNous
*/
import { z } from 'zod'

export const PARTNER_OAUTH_SCOPES = [
  'account:read',
  'credential:read',
  'payment:read',
  'payment:write',
  'offline_access',
] as const

export type PartnerOAuthScope = (typeof PARTNER_OAUTH_SCOPES)[number]

export const PARTNER_OAUTH_AUTH_METHODS = [
  'client_secret_basic',
  'none',
] as const

export type PartnerOAuthAuthMethod = (typeof PARTNER_OAUTH_AUTH_METHODS)[number]

export interface PartnerOAuthClient {
  id: number
  client_id: string
  name: string
  token_auth_method: PartnerOAuthAuthMethod
  redirect_uris: string[]
  scopes: string[]
  status: 1 | 2
  created_at: number
  updated_at: number
  client_secret?: string
}

export interface PartnerOAuthClientCreateInput {
  name: string
  token_auth_method: PartnerOAuthAuthMethod
  redirect_uris: string[]
  scopes: string[]
}

export interface PartnerOAuthClientUpdateInput {
  name: string
  redirect_uris: string[]
  scopes: string[]
}

const redirectUriSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Enter a valid absolute URL')

export const partnerOAuthClientFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(64),
  token_auth_method: z.enum(PARTNER_OAUTH_AUTH_METHODS),
  redirect_uris: z
    .string()
    .trim()
    .min(1, 'Add at least one redirect URI')
    .superRefine((value, ctx) => {
      const uris = value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
      if (uris.length === 0 || uris.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide 1–10 redirect URIs',
        })
        return
      }
      for (const uri of uris) {
        const parsed = redirectUriSchema.safeParse(uri)
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: parsed.error.issues[0]?.message ?? 'Invalid redirect URI',
          })
          return
        }
      }
    }),
  scopes: z
    .array(z.enum(PARTNER_OAUTH_SCOPES))
    .min(1, 'Select at least one scope'),
})

export type PartnerOAuthClientFormValues = z.infer<
  typeof partnerOAuthClientFormSchema
>

export function parseRedirectURIs(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export interface PartnerServerJobProgress {
  running: boolean
  processed: number
  error?: string
}

export interface PartnerServerSecret {
  id: number
  status: 'active' | 'revoked'
  created_at: number
  revoked_at: number
}

export interface PartnerServerConfig {
  client_id: string
  configured: boolean
  enabled: boolean
  account_group: string
  ip_allowlist: string[]
  max_accounts: number
  accounts_per_minute: number
  suspended: boolean
  account_count: number
  jobs: Record<'suspension' | 'key_revocation', PartnerServerJobProgress>
  secrets: PartnerServerSecret[]
}

export interface PartnerServerConfigInput {
  enabled: boolean
  account_group: string
  ip_allowlist: string[]
  max_accounts: number
  accounts_per_minute: number
}

export interface PartnerServerAccount {
  id: number
  external_user_id: string
  user_id: number
  status: 'active' | 'disabled' | 'admin_disabled'
  suspended_by_partner: boolean
  quota: number
  used_quota: number
  created_at: number
}

export interface PartnerServerAccountPage {
  items: PartnerServerAccount[]
  total: number
  page: number
  page_size: number
}

// A coarse shape check; the server parses each entry strictly.
const ipEntryPattern = /^[0-9A-Fa-f:.]+(\/\d{1,3})?$/

export function parseIPAllowlist(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const partnerServerConfigFormSchema = z.object({
  enabled: z.boolean(),
  account_group: z.string().trim().min(1, 'Select a user group'),
  ip_allowlist: z.string().superRefine((value, ctx) => {
    const entries = parseIPAllowlist(value)
    if (entries.length > 64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At most 64 entries',
      })
      return
    }
    if (entries.some((entry) => !ipEntryPattern.test(entry))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter IP addresses or CIDR ranges, one per line',
      })
    }
  }),
  max_accounts: z.number().int().min(1).max(1_000_000),
  accounts_per_minute: z.number().int().min(1).max(10_000),
})

export type PartnerServerConfigFormValues = z.infer<
  typeof partnerServerConfigFormSchema
>
