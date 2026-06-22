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
import { AlertCircle, AlertTriangle, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { opsConsoleOutlineButtonClassName } from '@/lib/ops-ui-styles'
import { MESSAGE_STATUS } from '../constants'
import {
  PLAYGROUND_BILLING_MODEL_PRICING_PATH,
  getPlaygroundErrorTitle,
  parsePlaygroundErrorDisplay,
} from '../lib/playground-error-display'
import type { Message } from '../types'

interface MessageErrorProps {
  message: Message
  className?: string
}

const chatErrorCardClassName =
  'rounded-lg border px-4 py-3 text-sm shadow-sm'

const chatErrorModelPriceClassName = cn(
  chatErrorCardClassName,
  'border-amber-200 bg-amber-50 text-amber-950'
)

const chatErrorGenericClassName = cn(
  chatErrorCardClassName,
  'border-red-200 bg-red-50 text-red-950'
)

/**
 * Chat-only error card (light ops theme).
 */
export function MessageError({ message, className = '' }: MessageErrorProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = user?.role != null && user.role >= 10

  if (message.status !== MESSAGE_STATUS.ERROR) {
    return null
  }

  const errorContent =
    message.versions[0]?.content || t('Playground generic service error body')
  const { paragraphs, requestId } = parsePlaygroundErrorDisplay(errorContent)
  const errorTitle = getPlaygroundErrorTitle(message.errorCode)

  if (message.errorCode === 'model_price_error') {
    return (
      <div
        role='alert'
        className={cn(chatErrorModelPriceClassName, className)}
      >
        <div className='flex gap-2'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-600' />
          <div className='min-w-0 flex-1 space-y-2'>
            <p className='font-medium text-amber-900'>{errorTitle}</p>
            <div className='space-y-2 text-amber-900/85'>
              {(paragraphs.length > 0 ? paragraphs : [errorContent]).map(
                (paragraph) => (
                  <p key={paragraph} className='leading-relaxed'>
                    {paragraph}
                  </p>
                )
              )}
            </div>
            {requestId ? (
              <p className='text-xs text-amber-800/70'>
                {t('Playground request id label', { id: requestId })}
              </p>
            ) : null}
            {isAdmin ? (
              <Button
                variant='outline'
                size='sm'
                className={opsConsoleOutlineButtonClassName}
                onClick={() =>
                  window.open(PLAYGROUND_BILLING_MODEL_PRICING_PATH, '_blank')
                }
              >
                <Settings className='mr-1 h-3.5 w-3.5' />
                {t('Go to Settings')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div role='alert' className={cn(chatErrorGenericClassName, className)}>
      <div className='flex gap-2'>
        <AlertCircle className='mt-0.5 size-4 shrink-0 text-red-600' />
        <div className='min-w-0 flex-1 space-y-2'>
          <p className='font-medium text-red-900'>{errorTitle}</p>
          <div className='space-y-2 text-red-900/85'>
            {(paragraphs.length > 0 ? paragraphs : [errorContent]).map(
              (paragraph) => (
                <p key={paragraph} className='leading-relaxed'>
                  {paragraph}
                </p>
              )
            )}
          </div>
          {requestId ? (
            <p className='text-xs text-red-800/70'>
              {t('Playground request id label', { id: requestId })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
