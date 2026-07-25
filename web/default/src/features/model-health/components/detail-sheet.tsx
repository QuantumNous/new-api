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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useModelHealthDetail } from '../hooks/use-model-health'
import { formatTimestamp } from '../lib'
import type { ModelHealthDetail, ModelHealthWindow } from '../types'
import { DetailCharts } from './detail-charts'
import { DetailKpis, GroupBreakdown } from './detail-metrics'
import { HealthBadge } from './health-badge'

function QualityNote(props: { detail: ModelHealthDetail }) {
  const { t } = useTranslation()
  return (
    <Alert>
      <HugeiconsIcon
        icon={InformationCircleIcon}
        strokeWidth={2}
        aria-hidden='true'
      />
      <AlertTitle>{t('Best-effort persisted data')}</AlertTitle>
      <AlertDescription className='flex flex-col gap-1'>
        <p>
          {t('Persisted data cutoff: {{time}}', {
            time: formatTimestamp(props.detail.data_cutoff),
          })}
        </p>
        <p>
          {t('Observed coverage: {{first}} to {{last}}', {
            first: formatTimestamp(props.detail.first_observed_at),
            last: formatTimestamp(props.detail.last_observed_at),
          })}
        </p>
        <p>
          {t(
            'Client disconnects count as unsuccessful final requests, which can lower observed completion rate.'
          )}
        </p>
        <p>
          {t(
            'Metrics lost before a node flushes cannot be detected from persisted data.'
          )}
        </p>
      </AlertDescription>
    </Alert>
  )
}

function DetailLoading() {
  return (
    <div className='flex flex-col gap-4 px-4 pb-6'>
      <Skeleton className='h-20 w-full rounded-xl' />
      <div className='grid gap-3 xl:grid-cols-2'>
        <Skeleton className='h-72 w-full rounded-xl' />
        <Skeleton className='h-72 w-full rounded-xl' />
      </div>
      <Skeleton className='h-48 w-full rounded-xl' />
    </div>
  )
}

export function ModelHealthDetailSheetContent(props: {
  model: string | null
  hours: ModelHealthWindow
}) {
  const { t } = useTranslation()
  const detailQuery = useModelHealthDetail(props.model, props.hours)
  const detail = detailQuery.data

  return (
    <>
      <SheetHeader>
        <div className='flex flex-wrap items-center gap-2'>
          <SheetTitle className='font-mono'>
            {props.model ?? t('Model health details')}
          </SheetTitle>
          {detail && <HealthBadge state={detail.model.health} />}
        </div>
        <SheetDescription>
          {t('Observed final-request health for the selected window.')}
        </SheetDescription>
      </SheetHeader>

      {detailQuery.isLoading && <DetailLoading />}
      {detailQuery.isError && !detail && (
        <div className='px-4 pb-6'>
          <Alert variant='destructive'>
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
            <AlertTitle>{t('Unable to load model health details')}</AlertTitle>
            <AlertDescription>
              <Button
                size='sm'
                variant='outline'
                disabled={detailQuery.isFetching}
                onClick={() => void detailQuery.refetch()}
              >
                {t('Retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {detail && (
        <div className='flex flex-col gap-4 px-4 pb-6'>
          <DetailKpis detail={detail} />
          {detail.series.length > 0 ? (
            <DetailCharts
              series={detail.series}
              healthyThreshold={detail.health_policy.healthy_success_rate_pct}
            />
          ) : (
            <Empty className='border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <HugeiconsIcon
                    icon={InformationCircleIcon}
                    strokeWidth={2}
                    aria-hidden='true'
                  />
                </EmptyMedia>
                <EmptyTitle>{t('No persisted trend data')}</EmptyTitle>
                <EmptyDescription>
                  {t(
                    'No bucketed requests were observed for this model in the selected window.'
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {detail.groups.length > 0 && <GroupBreakdown detail={detail} />}
          <QualityNote detail={detail} />
        </div>
      )}
    </>
  )
}

export function ModelHealthDetailSheet(props: {
  model: string | null
  hours: ModelHealthWindow
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={props.model !== null} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-5xl'>
        <ModelHealthDetailSheetContent
          model={props.model}
          hours={props.hours}
        />
      </SheetContent>
    </Sheet>
  )
}
