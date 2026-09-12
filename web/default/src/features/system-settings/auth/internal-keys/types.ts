import * as z from 'zod'

export const INTERNAL_KEY_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export type InternalKey = {
  id: number
  key_id: string
  key: string
  name: string
  status: number
  created_time: number
  accessed_time: number
}

export const internalKeyFormSchema = z.object({
  key_id: z
    .string()
    .trim()
    .max(64, 'Key ID must be at most 64 characters')
    .regex(
      /^[A-Za-z0-9_-]*$/,
      'Key ID can only contain letters, digits, hyphens and underscores'
    ),
  name: z.string().trim().max(128, 'Name must be at most 128 characters'),
  key: z
    .string()
    .trim()
    .max(128, 'Key must be at most 128 characters')
    .refine((value) => value === '' || value.length >= 8, {
      message: 'Key must be 8-128 characters',
    }),
  enabled: z.boolean().default(true),
})

export type InternalKeyFormValues = z.infer<typeof internalKeyFormSchema>
