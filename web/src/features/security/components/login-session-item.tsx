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
import { LaptopIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatDisplayDate, formatFromNow } from '@/lib/format'
import type { LoginSession } from '@/stores/auth-store'

import { loginMethodLabel, sessionDevice } from './login-session-utils'

interface LoginSessionItemProps {
  session: LoginSession
  onRevoke: (session: LoginSession) => void
}

export function LoginSessionItem({ session, onRevoke }: LoginSessionItemProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const maxTouchPoints =
    session.current && typeof navigator !== 'undefined'
      ? navigator.maxTouchPoints
      : 0

  return (
    <div className='flex flex-col gap-3 py-4 sm:flex-row sm:items-center'>
      <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg'>
        <HugeiconsIcon icon={LaptopIcon} className='size-5' strokeWidth={2} />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='font-medium'>
            {sessionDevice(
              session.user_agent,
              t('Unknown device'),
              t('Browser'),
              maxTouchPoints
            )}
          </p>
          {session.current && <Badge variant='secondary'>{t('Current')}</Badge>}
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('IP: {{ip}} · Method: {{method}}', {
            ip: session.ip || t('Unknown'),
            method: loginMethodLabel(session.login_method, t),
          })}
        </p>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('Last active {{time}} · Expires {{expires}}', {
            time: formatFromNow(session.last_active_at * 1000, locale),
            expires: formatDisplayDate(
              session.expires_at * 1000,
              'YYYY-MM-DD HH:mm',
              locale
            ),
          })}
        </p>
      </div>
      <Button
        type='button'
        variant={session.current ? 'outline' : 'ghost'}
        size='sm'
        onClick={() => onRevoke(session)}
      >
        {session.current ? t('Sign out') : t('Revoke')}
      </Button>
    </div>
  )
}
