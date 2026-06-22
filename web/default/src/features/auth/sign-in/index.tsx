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
import { Link, useSearch } from '@tanstack/react-router'
import { Coins, Plug, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  opsAuthBrandDescriptionClassName,
  opsAuthBrandTitleClassName,
  opsAuthCapabilityIconClassName,
  opsAuthCapabilityItemClassName,
  opsAuthCapabilityLabelClassName,
  opsAuthCardClassName,
} from '@/lib/ops-ui-styles'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useStatus } from '@/hooks/use-status'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

const CAPABILITY_ITEMS = [
  { icon: Plug, labelKey: 'Unified model service access' },
  { icon: Coins, labelKey: 'Unified token resource operations' },
  { icon: Users, labelKey: 'Tenant management' },
  { icon: ShieldCheck, labelKey: 'Call audit and operations monitoring' },
] as const

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()
  const { logo, loading: logoLoading } = useSystemConfig()

  const sidebar = (
    <div className='mx-auto w-full max-w-lg space-y-8 lg:mx-0'>
      <div className='space-y-5'>
        <div className='flex items-center gap-3'>
          <div className='relative h-11 w-11 shrink-0'>
            {logoLoading ? (
              <Skeleton className='absolute inset-0 rounded-xl' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                className='h-11 w-11 rounded-xl object-cover ring-1 ring-[#DBEAFE]'
              />
            )}
          </div>
        </div>
        <div className='space-y-3'>
          <h1 className={opsAuthBrandTitleClassName}>
            {t('Yunhe Xingze Token Operations Center')}
          </h1>
          <p className={opsAuthBrandDescriptionClassName}>
            {t(
              'Integrated model services and AI resource operations platform for government and enterprise'
            )}
          </p>
        </div>
      </div>

      <ul className='space-y-3'>
        {CAPABILITY_ITEMS.map(({ icon: Icon, labelKey }) => (
          <li
            key={labelKey}
            className={opsAuthCapabilityItemClassName}
          >
            <span className={opsAuthCapabilityIconClassName}>
              <Icon className='size-4' aria-hidden />
            </span>
            <span className={opsAuthCapabilityLabelClassName}>
              {t(labelKey)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <AuthLayout sidebar={sidebar}>
      <Card className={opsAuthCardClassName}>
        <CardContent className='space-y-8 p-6 sm:p-8'>
          <div className='space-y-2'>
            <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
              {t('Sign in')}
            </h2>
            {!status?.self_use_mode_enabled &&
              status?.register_enabled !== false && (
                <p className='text-muted-foreground text-left text-sm sm:text-base'>
                  {t("Don't have an account?")}{' '}
                  <Link
                    to='/sign-up'
                    className='hover:text-primary font-medium underline underline-offset-4'
                  >
                    {t('Sign up')}
                  </Link>
                  .
                </p>
              )}
          </div>

          <UserAuthForm redirectTo={redirect} />

          <TermsFooter
            variant='sign-in'
            status={status}
            className='text-center'
          />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
