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
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { AutoPricingSourceStatus, AutoPricingStatus } from '../types'

export function AutoPricingStatusPanel(props: {
  isLoading: boolean
  error?: string
  status?: AutoPricingStatus
  isSyncing: boolean
  onSync: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className='space-y-4 rounded-lg border p-4'
      aria-busy={props.isLoading}
    >
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0 space-y-1 text-sm'>
          <p className='font-medium'>{t('Catalog status')}</p>
          <p className='text-muted-foreground'>
            <AutoPricingStatusText
              isLoading={props.isLoading}
              status={props.status}
            />
          </p>
          {props.error ? (
            <p className='text-destructive'>{props.error}</p>
          ) : null}
          {props.status?.last_error ? (
            <p className='text-destructive break-words'>
              {t('Last sync failed: {{error}}', {
                error: props.status.last_error,
              })}
            </p>
          ) : null}
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={props.onSync}
          disabled={props.isSyncing}
        >
          <RefreshCw
            aria-hidden='true'
            className={props.isSyncing ? 'animate-spin' : undefined}
          />
          {props.isSyncing ? t('Syncing...') : t('Sync now')}
        </Button>
      </div>

      {props.status ? <CatalogDetails status={props.status} /> : null}

      {props.status?.sources.length ? (
        <SourceList
          title={t('Automatic pricing sources')}
          sources={props.status.sources}
        />
      ) : null}

      {props.status?.manual_sources.length ? (
        <SourceList
          title={t('Manual comparison sources')}
          sources={props.status.manual_sources}
        />
      ) : null}
    </div>
  )
}

function CatalogDetails(props: { status: AutoPricingStatus }) {
  const { t } = useTranslation()

  return (
    <dl className='grid gap-x-6 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2'>
      <Detail
        label={t('Catalog version')}
        value={props.status.version || t('Not loaded')}
      />
      <Detail
        label={t('Last successful sync')}
        value={formatDate(props.status.last_successful_at, t('Never'))}
      />
      <Detail
        label={t('Pending reviews')}
        value={String(props.status.pending_count)}
      />
      <Detail
        label={t('Pricing takeover')}
        value={
          props.status.takeover_complete ? t('Complete') : t('Not complete')
        }
      />
    </dl>
  )
}

function Detail(props: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground'>{props.label}</dt>
      <dd className='truncate font-medium' title={props.value}>
        {props.value}
      </dd>
    </div>
  )
}

function SourceList(props: {
  title: string
  sources: AutoPricingSourceStatus[]
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-2 border-t pt-3'>
      <p className='text-sm font-medium'>{props.title}</p>
      <div className='grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2'>
        {props.sources.map((source) => {
          let state = t('Not loaded')
          if (source.manual_only) state = t('Manual only')
          else if (source.error) state = t('Failed')
          else if (source.version) state = t('Healthy')

          return (
            <div key={source.source} className='min-w-0'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>{source.source}</span>
                <span
                  className={
                    source.error ? 'text-destructive' : 'text-muted-foreground'
                  }
                >
                  {state}
                </span>
              </div>
              <p
                className='text-muted-foreground truncate'
                title={source.version || source.url}
              >
                {source.version || source.url || t('No version reported')}
              </p>
              {source.error ? (
                <p className='text-destructive break-words'>{source.error}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AutoPricingStatusText(props: {
  isLoading: boolean
  status?: AutoPricingStatus
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return <>{t('Loading...')}</>
  }
  if (!props.status?.loaded) {
    return <>{t('No pricing catalog loaded yet')}</>
  }
  if (!props.status.updated_at) {
    return (
      <>
        {t('Catalog prices {{modelCount}} models', {
          modelCount: props.status.model_count,
        })}
      </>
    )
  }
  return (
    <>
      {t('Catalog prices {{modelCount}} models, updated {{time}}', {
        modelCount: props.status.model_count,
        time: new Date(props.status.updated_at).toLocaleString(),
      })}
    </>
  )
}

function formatDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString()
}
