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
