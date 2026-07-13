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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getPendingLoginVerification } from '@/features/auth/api'

import { AuthLayout } from '../auth-layout'
import { LoginVerification } from './components/otp-form'

export function Otp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const verificationQuery = useQuery({
    queryKey: ['auth', 'pending-login-verification'],
    queryFn: async () => {
      const response = await getPendingLoginVerification()
      if (!response.success || !response.data?.require_verification) {
        throw new Error(response.message || t('Login session has expired'))
      }
      return response.data
    },
    retry: false,
    gcTime: 0,
  })
  const requirements = verificationQuery.data

  useEffect(() => {
    if (!verificationQuery.error) {
      return
    }
    toast.error(
      verificationQuery.error instanceof Error
        ? verificationQuery.error.message
        : t('Login session has expired')
    )
    navigate({ to: '/sign-in', replace: true })
  }, [navigate, t, verificationQuery.error])

  return (
    <AuthLayout>
      <div className='flex min-h-48 w-full items-center justify-center'>
        {requirements ? (
          <LoginVerification requirements={requirements} />
        ) : (
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        )}
      </div>
    </AuthLayout>
  )
}
