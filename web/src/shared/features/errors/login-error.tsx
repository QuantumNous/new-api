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
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/components/ui/button'
import { clearStaleLoginState } from '@/shared/features/auth/lib/login-recovery'

/**
 * Fallback shown when the login route itself crashes (for example a failed
 * chunk load or a search-schema error). It guarantees the visitor always sees
 * a recoverable screen instead of a blank page.
 */
export function LoginError() {
  const { t } = useTranslation()

  return (
    <div className='flex h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center'>
      <h1 className='text-xl font-semibold'>
        {t('Something went wrong, please refresh')}
      </h1>
      <Button
        onClick={() => {
          // A crash here usually means stale local data survived; clear it
          // before reloading so the retry starts from a clean boot.
          clearStaleLoginState()
          window.location.reload()
        }}
      >
        {t('Refresh')}
      </Button>
    </div>
  )
}
