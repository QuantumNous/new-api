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
import { Edit, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

type MessageErrorActionsProps = {
  disabled?: boolean
  onDelete?: () => void
  onEditPrompt?: () => void
  onRetry?: () => void
}

export function MessageErrorActions({
  disabled = false,
  onDelete,
  onEditPrompt,
  onRetry,
}: MessageErrorActionsProps) {
  const { t } = useTranslation()

  if (!onRetry && !onEditPrompt && !onDelete) {
    return null
  }

  return (
    <div className='flex flex-wrap gap-2 pt-2'>
      {onRetry && (
        <Button
          className='max-md:min-h-11'
          disabled={disabled}
          onClick={onRetry}
          size='sm'
        >
          <RefreshCw className='size-3.5' />
          {t('Retry')}
        </Button>
      )}

      {onEditPrompt && (
        <Button
          className='max-md:min-h-11'
          disabled={disabled}
          onClick={onEditPrompt}
          size='sm'
          variant='outline'
        >
          <Edit className='size-3.5' />
          {t('Edit')}
        </Button>
      )}

      {onDelete && (
        <Button
          className='max-md:min-h-11'
          disabled={disabled}
          onClick={onDelete}
          size='sm'
          variant='destructive'
        >
          <Trash2 className='size-3.5' />
          {t('Delete')}
        </Button>
      )}
    </div>
  )
}
