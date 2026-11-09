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
import { useNavigate } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { UserAuthForm } from '@/shared/features/auth/sign-in/components/user-auth-form'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Administrator sign-in.
 *
 * Visually distinct from the client login and intentionally minimal: the same
 * hardened credential form is reused in `credentialsOnly` mode, so no OAuth
 * provider, Passkey, WeChat or registration entry point is reachable here.
 * `requiredRole` revokes the fresh session of an account below the Admin role
 * instead of forwarding it to the client portal. The RBAC decision remains
 * enforced by `requireAdminAccess` on every admin route.
 */
export function AdminLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.auth.user?.role)
  const bootstrapState = useAuthStore((state) => state.auth.bootstrapState)

  useEffect(() => {
    // Forward only a positively resolved session. A stale user kept in memory
    // across a transient refresh failure must not ping-pong with the admin
    // route guard, which sends unresolved sessions back to this page.
    if (
      bootstrapState === 'complete' &&
      role !== undefined &&
      role >= ROLE.ADMIN
    ) {
      void navigate({ to: '/admin/overview', replace: true })
    }
  }, [bootstrapState, navigate, role])

  return (
    <div className='flex min-h-svh items-center justify-center bg-slate-950 p-4 text-slate-100'>
      <div className='grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-[1fr_1.15fr]'>
        <aside className='hidden flex-col justify-between gap-8 border-e border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8 md:flex'>
          <div className='space-y-3'>
            <span className='inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400'>
              <ShieldCheck className='h-5 w-5' aria-hidden='true' />
            </span>
            <h1 className='text-xl font-semibold'>
              {t('Administrator access')}
            </h1>
            <p className='text-sm text-slate-400'>
              {t(
                'This portal is restricted to administrators. Administrative actions are audited.'
              )}
            </p>
          </div>
          <p className='text-xs text-slate-500'>
            {t('Unauthorized access attempts are rejected and logged.')}
          </p>
        </aside>
        <div className='space-y-6 p-6 sm:p-8'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>{t('Admin sign in')}</h2>
            <p className='text-sm text-slate-400'>
              {t('Use an administrator or root account to continue.')}
            </p>
          </div>
          <UserAuthForm
            redirectTo='/admin/overview'
            credentialsOnly
            requiredRole={ROLE.ADMIN}
          />
        </div>
      </div>
    </div>
  )
}
