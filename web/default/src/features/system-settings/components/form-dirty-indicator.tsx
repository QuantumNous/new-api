import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'

type FormDirtyIndicatorProps = {
  isDirty: boolean
  message?: string
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
}: FormDirtyIndicatorProps) {
  const { t } = useTranslation()
  if (!isDirty) return null

  return (
    <Alert
      variant='default'
      className='border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
    >
      <Info className='h-4 w-4 text-orange-600 dark:text-orange-500' />
      <AlertDescription className='text-orange-800 dark:text-orange-400'>
        {message ?? t('You have unsaved changes')}
      </AlertDescription>
    </Alert>
  )
}
