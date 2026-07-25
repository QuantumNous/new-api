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
import { Link } from '@tanstack/react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export function DeviceAuthOutcome(props: { outcome: 'approved' | 'denied' }) {
  const { t } = useTranslation()
  const approved = props.outcome === 'approved'

  return (
    <div className='flex flex-col items-start gap-4 rounded-xl border p-5'>
      <div className='flex items-center gap-2'>
        {approved ? (
          <CheckCircle2
            className='size-5 text-emerald-500'
            aria-hidden='true'
          />
        ) : (
          <XCircle className='text-destructive size-5' aria-hidden='true' />
        )}
        <h3 className='text-sm font-semibold'>
          {approved ? t('Device authorized') : t('Request denied')}
        </h3>
      </div>
      <p className='text-muted-foreground text-sm'>
        {approved
          ? t('You can close this page and return to the desktop app.')
          : t('The desktop app was not granted access to your account.')}
      </p>
      {approved ? (
        <Button variant='outline' render={<Link to='/keys' />}>
          {t('Manage API keys')}
        </Button>
      ) : null}
    </div>
  )
}
