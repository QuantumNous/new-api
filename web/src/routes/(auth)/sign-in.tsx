import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getStoredUser } from '@/lib/auth'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: () => {
    const user = getStoredUser()
    if (user) throw redirect({ to: '/' })
  },
  component: SignIn,
  validateSearch: searchSchema,
})
