/*
Copyright (C) 2023-2026 QuantumNous
*/
import { z } from 'zod'

export const PARTNER_OAUTH_SCOPES = [
  'account:read',
  'credential:read',
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
