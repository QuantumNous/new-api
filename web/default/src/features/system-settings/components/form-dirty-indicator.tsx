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
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'

type FormDirtyIndicatorProps = {
  isDirty: boolean
  message?: string
  /** Dark ops-center surfaces; does not affect default (light-friendly) pages */
  tone?: 'default' | 'cockpit'
}

/**
 * Visual indicator that the form has unsaved changes
 *
 * @example
 * ```tsx
 * <FormDirtyIndicator isDirty={form.formState.isDirty} />
 * ```
 */
export function FormDirtyIndicator({
  isDirty,
  message,
  tone = 'default',
}: FormDirtyIndicatorProps) {
  const { t } = useTranslation()
  if (!isDirty) return null

  const isCockpit = tone === 'cockpit'

  return (
    <Alert
      variant='default'
      className={cn(
        isCockpit
          ? 'border-amber-400/30 bg-amber-500/10'
          : 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
      )}
    >
      <Info
        className={cn(
          'h-4 w-4',
          isCockpit
            ? 'text-amber-200'
            : 'text-orange-600 dark:text-orange-500'
        )}
      />
      <AlertDescription
        className={cn(
          isCockpit
            ? 'text-amber-100'
            : 'text-orange-800 dark:text-orange-400'
        )}
      >
        {message ?? t('You have unsaved changes')}
      </AlertDescription>
    </Alert>
  )
}
