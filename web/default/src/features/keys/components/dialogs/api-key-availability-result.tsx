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
import {
  AlertCircleIcon,
  DashboardSpeed01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'

import type { ApiKeyModelTestResult } from '../../api'

type ApiKeyAvailabilityResultProps = {
  model: string
  result: ApiKeyModelTestResult | null
}

function formatResponseTime(responseTime: number) {
  if (responseTime >= 1000) return `${(responseTime / 1000).toFixed(2)} s`
  return `${responseTime} ms`
}

export function ApiKeyAvailabilityResult(props: ApiKeyAvailabilityResultProps) {
  const { t } = useTranslation()

  if (!props.result) {
    return (
      <Empty className='bg-muted/20 min-h-28 border p-4'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={DashboardSpeed01Icon} aria-hidden='true' />
          </EmptyMedia>
          <EmptyTitle>{t('Ready')}</EmptyTitle>
          <EmptyDescription>
            {t('Select a supported model and send a short test request.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const responseTime = props.result.responseTime
    ? formatResponseTime(props.result.responseTime)
    : undefined

  if (!props.result.success) {
    let message = props.result.message
    if (!message) {
      switch (props.result.failureKind) {
        case 'timeout':
          message = t('The request timed out.')
          break
        case 'network':
          message = t('Unable to reach the API.')
          break
        case 'invalid-response':
          message = t('The API response was invalid.')
          break
        default:
          message = t('API unavailable')
      }
    }

    return (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('API unavailable')}</AlertTitle>
        <AlertDescription className='mt-2 flex flex-col gap-3 text-left text-pretty'>
          <p className='break-words'>{message}</p>
          <dl className='grid gap-3 text-xs sm:grid-cols-3'>
            <div className='min-w-0'>
              <dt className='text-muted-foreground'>{t('Model')}</dt>
              <dd className='mt-1 truncate font-mono' title={props.model}>
                {props.model}
              </dd>
            </div>
            {props.result.endpointPath ? (
              <div className='min-w-0'>
                <dt className='text-muted-foreground'>{t('Endpoint')}</dt>
                <dd className='mt-1 truncate font-mono'>
                  {props.result.endpointPath}
                </dd>
              </div>
            ) : null}
            {responseTime ? (
              <div>
                <dt className='text-muted-foreground'>{t('Response Time')}</dt>
                <dd className='mt-1 font-mono tabular-nums'>{responseTime}</dd>
              </div>
            ) : null}
          </dl>
          {props.result.requestId ? (
            <>
              <Separator />
              <div className='min-w-0 text-xs'>
                <span className='text-muted-foreground'>{t('Request ID')}</span>
                <code className='mt-1 block break-all'>
                  {props.result.requestId}
                </code>
              </div>
            </>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className='border-success/30 bg-success/5 text-success'>
      <HugeiconsIcon icon={Tick02Icon} aria-hidden='true' />
      <AlertTitle>{t('API available')}</AlertTitle>
      <AlertDescription className='text-foreground mt-2 flex flex-col gap-3 text-left'>
        <dl className='grid gap-3 text-xs sm:grid-cols-3'>
          <div className='min-w-0'>
            <dt className='text-muted-foreground'>{t('Model')}</dt>
            <dd className='mt-1 truncate font-mono' title={props.model}>
              {props.model}
            </dd>
          </div>
          <div className='min-w-0'>
            <dt className='text-muted-foreground'>{t('Endpoint')}</dt>
            <dd className='mt-1 truncate font-mono'>
              {props.result.endpointPath}
            </dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>{t('Response Time')}</dt>
            <dd className='mt-1 font-mono tabular-nums'>
              {formatResponseTime(props.result.responseTime)}
            </dd>
          </div>
        </dl>

        {props.result.preview ? (
          <>
            <Separator />
            <div className='min-w-0 text-xs'>
              <span className='text-muted-foreground'>
                {t('Response preview')}
              </span>
              <p className='mt-1 break-words'>{props.result.preview}</p>
            </div>
          </>
        ) : null}

        {props.result.requestId ? (
          <>
            <Separator />
            <div className='min-w-0 text-xs'>
              <span className='text-muted-foreground'>{t('Request ID')}</span>
              <code className='mt-1 block break-all'>
                {props.result.requestId}
              </code>
            </div>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
