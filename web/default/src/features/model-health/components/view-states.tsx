/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { Alert02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTimestamp, windowLabelKey } from '../lib'
import type { ModelHealthOverview, ModelHealthWindow } from '../types'

export function ModelHealthSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-12 w-full rounded-xl' />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-32 w-full rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-96 w-full rounded-xl' />
    </div>
  )
}

export function ModelHealthError(props: {
  isFetching: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <Alert variant='destructive'>
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden='true' />
      <AlertTitle>{t('Unable to load model health')}</AlertTitle>
      <AlertDescription>
        {t('The persisted fleet view could not be retrieved.')}
      </AlertDescription>
      <AlertAction>
        <Button
          size='sm'
          variant='outline'
          disabled={props.isFetching}
          onClick={props.onRetry}
        >
          {t('Retry')}
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function ModelHealthEmpty(props: { collectionEnabled: boolean }) {
  const { t } = useTranslation()
  return (
    <Empty className='bg-card border py-14'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            aria-hidden='true'
          />
        </EmptyMedia>
        <EmptyTitle>{t('No observed final requests')}</EmptyTitle>
        <EmptyDescription>
          {props.collectionEnabled
            ? t(
                'No persisted model traffic was observed in the selected window.'
              )
            : t(
                'Performance metric collection is disabled, so no new health data is being recorded.'
              )}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function DataQualityBanner(props: {
  overview: ModelHealthOverview
  hours: ModelHealthWindow
}) {
  const { t } = useTranslation()
  const shortRetention =
    props.overview.retention_days > 0 &&
    props.overview.retention_days * 24 < props.hours

  return (
    <div className='flex flex-col gap-2' aria-live='polite'>
      {!props.overview.collection_enabled && (
        <Alert>
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            aria-hidden='true'
          />
          <AlertTitle>
            {t('Performance metric collection is disabled')}
          </AlertTitle>
          <AlertDescription>
            {t(
              'No new model health samples are being collected. Historical rows are not presented as health claims while collection is disabled.'
            )}
          </AlertDescription>
        </Alert>
      )}
      <Alert>
        <HugeiconsIcon
          icon={InformationCircleIcon}
          strokeWidth={2}
          aria-hidden='true'
        />
        <AlertTitle>{t('Best-effort persisted fleet view')}</AlertTitle>
        <AlertDescription className='flex flex-col gap-1'>
          <p>
            {t('Persisted data cutoff: {{time}}', {
              time: formatTimestamp(props.overview.data_cutoff),
            })}
          </p>
          <p>
            {t(
              'Observed coverage: {{first}} to {{last}} for the requested {{window}} window.',
              {
                first: formatTimestamp(props.overview.first_observed_at),
                last: formatTimestamp(props.overview.last_observed_at),
                window: t(windowLabelKey(props.hours)),
              }
            )}
          </p>
          {shortRetention && (
            <p>
              {t(
                'Retention is {{days}} days, shorter than the selected window.',
                { days: props.overview.retention_days }
              )}
            </p>
          )}
          <p>
            {t(
              'Client disconnects count as unsuccessful final requests, and metrics lost before a node flushes cannot be detected.'
            )}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
