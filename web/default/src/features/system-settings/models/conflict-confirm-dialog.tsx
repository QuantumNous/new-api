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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

        <div className='max-h-96 overflow-y-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Channel')}</TableHead>
                <TableHead>{t('Model')}</TableHead>
                <TableHead>{t('Current Billing')}</TableHead>
                <TableHead>{t('Change To')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conflicts.map((conflict, index) => (
                <TableRow key={index}>
                  <TableCell className='font-medium'>
                    {conflict.channel}
                  </TableCell>
                  <TableCell className='font-mono text-sm'>
                    {conflict.model}
                  </TableCell>
                  <TableCell>
                    <pre className='text-xs whitespace-pre-wrap'>
                      {conflict.current}
                    </pre>
                  </TableCell>
                  <TableCell>
                    <pre className='text-xs whitespace-pre-wrap'>
                      {conflict.newVal}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
