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
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import type { MarketplaceUpdate } from '../lib/marketplace'
import type { TaskPluginDetail } from '../types'
import { PluginIcon } from './plugin-icon'
import { PricingIssueList } from './pricing-issue-list'

export type UpdateResult =
  | { status: 'updated'; issues: TaskPluginDetail['pricing_issues'] }
  | { status: 'failed' | 'activation-failed'; message: string }
  | {
      status: 'skipped'
      reason: NonNullable<MarketplaceUpdate['skip']> | 'changed'
    }

export function MarketplaceUpdateRow(props: {
  item: MarketplaceUpdate
  result?: UpdateResult
  current: boolean
  busy: boolean
  skipMessage?: string
  onReview: (item: MarketplaceUpdate) => void
}) {
  const { t } = useTranslation()
  const item = props.item
  const key = item.plugin.key
  const result = props.result
  let action = (
    <Button
      size='sm'
      variant='ghost'
      aria-label={t('Review {{name}}', { name: item.plugin.name })}
      onClick={() => props.onReview(item)}
    >
      {t('Review changes')}
    </Button>
  )
  if (result?.status === 'updated') {
    action = (
      <span className='text-emerald-700 dark:text-emerald-400'>
        <CheckCircle2 />
        {t('Updated successfully')}
      </span>
    )
  } else if (result?.status === 'skipped') {
    action = <span className='text-muted-foreground'>{t('Skipped')}</span>
  } else if (result) {
    action = (
      <span className='text-destructive'>
        <CircleAlert />
        {t('Failed')}
      </span>
    )
  } else if (props.busy) {
    action = props.current ? (
      <span>
        <Spinner aria-hidden='true' />
        {t('Updating')}
      </span>
    ) : (
      <span className='text-muted-foreground'>{t('Queued')}</span>
    )
  }
  return (
    <li className='space-y-2 px-3.5 py-3'>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_7rem]'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <PluginIcon
            plugin={{
              ...item.plugin,
              hasIcon: item.installed.has_icon,
            }}
            size={28}
          />
          <div className='min-w-0'>
            <p className='text-sm font-medium break-words'>
              {item.plugin.name}
            </p>
            <p
              className='text-muted-foreground truncate font-mono text-xs'
              title={key}
            >
              {key}
            </p>
          </div>
        </div>
        <div className='col-start-1 row-start-2 flex flex-wrap items-center gap-1.5 pl-9 font-mono text-xs break-all sm:col-start-2 sm:row-start-1 sm:pl-0'>
          <span className='text-muted-foreground'>
            v{item.installed.meta.version}
          </span>
          <ArrowRight
            aria-hidden='true'
            className='text-muted-foreground size-3'
          />
          <span className='bg-muted rounded px-1.5 py-0.5'>
            v{item.target.version}
          </span>
        </div>
        <div className='col-start-2 row-start-1 justify-self-end text-xs sm:col-start-3 [&_svg]:size-3.5 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5'>
          {action}
        </div>
      </div>
      {result?.status === 'skipped' && (
        <p className='text-muted-foreground text-xs'>{props.skipMessage}</p>
      )}
      {(result?.status === 'failed' ||
        result?.status === 'activation-failed') && (
        <div className='text-destructive text-xs break-words'>
          {result.status === 'activation-failed' && (
            <p className='font-medium'>
              {t('Uploaded, but activation failed.')}
            </p>
          )}
          <p>{result.message}</p>
        </div>
      )}
      {result?.status === 'updated' &&
        result.issues &&
        result.issues.length > 0 && (
          <div className='text-xs text-amber-700 dark:text-amber-400'>
            <PricingIssueList issues={result.issues} />
          </div>
        )}
    </li>
  )
}
