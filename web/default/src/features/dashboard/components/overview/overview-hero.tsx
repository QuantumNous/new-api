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
import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const WELCOME_NOTICE_DISMISSED_STORAGE_KEY =
  'dashboard_overview_welcome_dismissed'

function getWelcomeNoticeDismissed(): boolean {
  if (typeof window === 'undefined') return true
  // Private mode or a restricted WebView can throw on any storage access.
  try {
    return (
      window.localStorage.getItem(WELCOME_NOTICE_DISMISSED_STORAGE_KEY) === '1'
    )
  } catch {
    return false
  }
}

export function OverviewHero() {
  const { t } = useTranslation()
  const [noticeDismissed, setNoticeDismissed] = useState(
    getWelcomeNoticeDismissed
  )

  const handleDismiss = () => {
    setNoticeDismissed(true)
    try {
      window.localStorage.setItem(WELCOME_NOTICE_DISMISSED_STORAGE_KEY, '1')
    } catch {
      // Storage is unavailable; the dismissal lives for this session only.
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <span className='text-primary text-xs font-bold tracking-[0.1em] uppercase'>
          {t('Your AI gateway')}
        </span>
        <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
          {t('Build with any model, your way.')}
        </h1>
        <p className='text-muted-foreground max-w-2xl text-base'>
          {t(
            'One key, every leading model. Choose a starting point below and be up and running in minutes.'
          )}
        </p>
      </div>

      {!noticeDismissed && (
        <div className='bg-primary/5 border-primary/20 flex items-start gap-3 rounded-xl border p-4'>
          <div className='flex-1'>
            <div className='font-semibold'>{t('Welcome to Flatkey')}</div>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t(
                'Your account is ready. Add an API key, then choose the integration that fits your workflow.'
              )}
            </p>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleDismiss}
            aria-label={t('Dismiss')}
          >
            <X data-icon='inline-start' />
            {t('Dismiss')}
          </Button>
        </div>
      )}
    </div>
  )
}
