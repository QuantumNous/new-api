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
import { Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

// Show the top-up nudge while the balance is below ~$1 of usage. New users
// start with a tiny trial quota, so this naturally targets them too.
const LOW_BALANCE_QUOTA = 500000

export function TopupNudge() {
  const { t } = useTranslation()
  const quota = useAuthStore((s) => s.auth.user?.quota)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || quota === undefined || quota >= LOW_BALANCE_QUOTA) {
    return null
  }

  return (
    <div className='border-accent/30 from-accent/10 relative flex flex-col gap-3 rounded-xl border bg-gradient-to-r to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
      <div className='flex items-start gap-3'>
        <div className='bg-accent/15 flex size-10 shrink-0 items-center justify-center rounded-lg'>
          <Wallet className='text-accent-foreground size-5' strokeWidth={1.75} />
        </div>
        <div>
          <p className='font-semibold'>
            {t('Your balance is low — top up to get started')}
          </p>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Add credit to start calling Claude, GPT, Gemini and more — it only takes a few seconds.'
            )}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-1 sm:shrink-0'>
        <Link to='/wallet'>
          <Button size='sm'>{t('Top up now')}</Button>
        </Link>
        <button
          type='button'
          onClick={() => setDismissed(true)}
          aria-label={t('Dismiss')}
          className='text-muted-foreground hover:text-foreground p-1.5'
        >
          <X className='size-4' />
        </button>
      </div>
    </div>
  )
}
