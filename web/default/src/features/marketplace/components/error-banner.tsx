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
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorBannerProps {
  title?: string
  message: string
  requestId?: string
  retryable?: boolean
  onRetry?: () => void
}

export function ErrorBanner({
  title,
  message,
  requestId,
  retryable,
  onRetry,
}: ErrorBannerProps) {
  const { t } = useTranslation()

  return (
    <Alert variant='destructive' aria-live='polite'>
      <AlertTriangle aria-hidden='true' />
      <AlertTitle>{title ?? t('Marketplace request failed')}</AlertTitle>
      <AlertDescription>
        <div className='flex flex-col gap-1'>
          <span>{message}</span>
          {requestId != null && requestId !== '' && (
            <span>
              {t('Request ID')}: <code>{requestId}</code>
            </span>
          )}
        </div>
      </AlertDescription>
      {retryable && onRetry != null && (
        <AlertAction>
          <Button type='button' size='sm' variant='outline' onClick={onRetry}>
            <RefreshCcw data-icon='inline-start' />
            {t('Retry')}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
