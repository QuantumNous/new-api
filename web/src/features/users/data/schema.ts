import { z } from 'zod'

// User status: 1 = enabled, 2 = disabled, 3+ = other states
export const userStatusSchema = z.number()
export type UserStatus = z.infer<typeof userStatusSchema>

// User role: 1 = common user, 10 = admin, 100 = root
export const userRoleSchema = z.number()
export type UserRole = z.infer<typeof userRoleSchema>

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  display_name: z.string(),
  password: z.string().optional(),
  github_id: z.string().optional(),
  oidc_id: z.string().optional(),
  wechat_id: z.string().optional(),
  telegram_id: z.string().optional(),
  email: z.string().optional(),
  quota: z.number(),
  used_quota: z.number(),
  request_count: z.number(),
  group: z.string(),
  aff_code: z.string().optional(),
  aff_count: z.number().optional(),
  aff_quota: z.number().optional(),
  aff_history_quota: z.number().optional(),
  inviter_id: z.number().optional(),
  linux_do_id: z.string().optional(),
  status: userStatusSchema,
  role: userRoleSchema,
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  deleted_at: z.number().nullable().optional(),
  remark: z.string().optional(),
})
export type User = z.infer<typeof userSchema>

export const userListSchema = z.array(userSchema)
