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
import { isSafeInternalPath } from '@/features/auth/lib/storage'
import { SignUp } from '@/features/auth/sign-up'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { auth } = useAuthStore.getState()

    // Already logged in (e.g. clicking "Get API Key" while authenticated): skip the
    // sign-up form entirely and go straight to the intended destination (the API Keys
    // tab via ?redirect=/keys), falling back to the dashboard. Mirrors sign-in.
    if (auth.user) {
      // redirect comes from the URL; validate it as an internal path to avoid an
      // open-redirect, falling back to the dashboard.
      throw redirect({
        to: isSafeInternalPath(search?.redirect)
          ? search.redirect
          : '/dashboard',
      })
    }
  },
})
