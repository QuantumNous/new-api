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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

// /login is a canonical alias for /sign-in (owner preference for clean URLs).
// Renders the same SignIn component. Any redirect param is preserved.
export const Route = createFileRoute('/(auth)/login')({
  component: SignIn,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { auth } = useAuthStore.getState()

    if (auth.user) {
      throw redirect({ to: search?.redirect || '/dashboard' })
    }
  },
})
