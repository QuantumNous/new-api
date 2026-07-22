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

import { StaticDataTable } from '@/components/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export type ConflictItem = {
  channel: string
  model: string
  current: string
  newVal: string
}

type ConflictConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictItem[]
  onConfirm: () => void
  isLoading?: boolean
}

export function ConflictConfirmDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  isLoading = false,
}: ConflictConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-w-4xl'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Confirm Billing Conflicts')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'The following models have billing type conflicts (fixed price vs ratio billing). Confirm to proceed with the changes.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <StaticDataTable
          className='max-h-96 overflow-y-auto'
          data={conflicts}
          columns={[
            {
              id: 'channel',
              header: t('Channel'),
              cellClassName: 'font-medium',
              cell: (conflict) => conflict.channel,
            },
            {
              id: 'model',
              header: t('Model'),
              cellClassName: 'font-mono text-sm',
              cell: (conflict) => conflict.model,
            },
            {
              id: 'current',
              header: t('Current Billing'),
              cell: (conflict) => (
                <pre className='text-sm whitespace-pre-wrap'>
                  {conflict.current}
                </pre>
              ),
            },
            {
              id: 'new',
              header: t('Change To'),
              cell: (conflict) => (
                <pre className='text-sm whitespace-pre-wrap'>
                  {conflict.newVal}
                </pre>
              ),
            },
          ]}
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? t('Applying...') : t('Confirm Changes')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
