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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Shown while authenticated routes verify the session before rendering the shell. */
export function AuthSessionPending() {
  const { t } = useTranslation()

  return (
    <div className='bg-background flex min-h-svh w-full items-center justify-center'>
      <div className='text-muted-foreground flex flex-col items-center gap-3'>
        <Loader2 className='text-foreground size-8 animate-spin' aria-hidden />
        <p className='text-sm'>{t('Loading...')}</p>
      </div>
    </div>
  )
}
