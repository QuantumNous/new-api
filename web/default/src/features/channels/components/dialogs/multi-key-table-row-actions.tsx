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
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { MultiKeyConfirmAction } from '../../types'

type MultiKeyTableRowActionsProps = {
  keyIndex: number
  status: number
  canDelete: boolean
  isBusy: boolean
  isTesting: boolean
  onTest: (keyIndex: number) => void
  onAction: (action: MultiKeyConfirmAction) => void
}

export function MultiKeyTableRowActions({
  keyIndex,
  status,
  canDelete,
  isBusy,
  isTesting,
  onTest,
  onAction,
}: MultiKeyTableRowActionsProps) {
  const { t } = useTranslation()
  const isEnabled = status === 1

  return (
    <div className='flex justify-end gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={() => onTest(keyIndex)}
        disabled={isBusy}
      >
        {isTesting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
        {t('Test')}
      </Button>
      {isEnabled ? (
        <Button
          variant='outline'
          size='sm'
          onClick={() => onAction({ type: 'disable', keyIndex })}
          disabled={isBusy}
        >
          {t('Disable')}
        </Button>
      ) : (
        <Button
          variant='outline'
          size='sm'
          onClick={() => onAction({ type: 'enable', keyIndex })}
          disabled={isBusy}
        >
          {t('Enable')}
        </Button>
      )}
      <Button
        variant='destructive'
        size='sm'
        onClick={() => {
          if (!canDelete || isBusy) return
          onAction({ type: 'delete', keyIndex })
        }}
        disabled={!canDelete || isBusy}
        title={
          canDelete ? undefined : t('No permission to perform this action')
        }
      >
        {t('Delete')}
      </Button>
    </div>
  )
}
