import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MESSAGE_STATUS } from '../constants'
import type { Message } from '../types'

interface MessageErrorProps {
  message: Message
  className?: string
}

/**
 * Display error messages using Alert component
 * Following ai-elements pattern for error handling
 */
export function MessageError({ message, className = '' }: MessageErrorProps) {
  const { t } = useTranslation()
  // Only show for error status
  if (message.status !== MESSAGE_STATUS.ERROR) {
    return null
  }

  // Get error content from the first version
  const errorContent =
    message.versions[0]?.content || 'An unknown error occurred'

  return (
    <Alert variant='destructive' className={className}>
      <AlertCircle />
      <AlertTitle>{t('Error')}</AlertTitle>
      <AlertDescription>{errorContent}</AlertDescription>
    </Alert>
  )
}
