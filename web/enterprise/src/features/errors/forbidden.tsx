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
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function ForbiddenError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='flex min-h-svh items-center justify-center bg-background p-4'>
      <div className='w-full max-w-[800px]'>
        <div className='rounded-[8px] border border-border bg-card p-12 text-center shadow-sm'>
          <div className='text-[72px] font-bold leading-none tracking-tight text-muted-foreground'>
            403
          </div>
          <h2 className='mt-4 text-xl font-semibold'>
            {t('Access Forbidden')}
          </h2>
          <p className='mx-auto mt-2 max-w-[320px] text-sm text-muted-foreground'>
            {t("You don't have necessary permission")}{' '}
            {t('to view this resource.')}
          </p>
          <div className='mt-6 flex justify-center gap-2'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              {t('Go Back')}
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>
              {t('Back to Home')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
