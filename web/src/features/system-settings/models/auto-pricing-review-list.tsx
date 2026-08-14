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
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

import type { AutoPricingPendingReview } from '../types'

export function AutoPricingReviewList(props: {
  items: AutoPricingPendingReview[]
  isLoading: boolean
  error?: string
  selectedModels: string[]
  onSelectionChange: (models: string[]) => void
  isReviewing: boolean
  onReview: (action: 'approve' | 'reject') => void
}) {
  const { t } = useTranslation()
  const selected = new Set(props.selectedModels)

  function toggle(model: string, checked: boolean) {
    props.onSelectionChange(
      checked
        ? [...new Set([...props.selectedModels, model])]
        : props.selectedModels.filter((item) => item !== model)
    )
  }

  return (
    <div className='space-y-3' aria-busy={props.isLoading}>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-medium'>{t('Pending pricing reviews')}</p>
          <p className='text-muted-foreground text-sm'>
            {props.isLoading
              ? t('Loading...')
              : t('{{count}} changes require review', {
                  count: props.items.length,
                })}
          </p>
          {props.error ? (
            <p className='text-destructive text-sm'>{props.error}</p>
          ) : null}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={props.isReviewing || selected.size === 0}
            onClick={() => props.onReview('reject')}
          >
            <X aria-hidden='true' />
            {t('Reject selected')}
          </Button>
          <Button
            type='button'
            disabled={props.isReviewing || selected.size === 0}
            onClick={() => props.onReview('approve')}
          >
            <Check aria-hidden='true' />
            {t('Approve selected')}
          </Button>
        </div>
      </div>

      {!props.isLoading && props.items.length === 0 ? (
        <p className='text-muted-foreground border-t py-4 text-sm'>
          {t('No pricing changes require review')}
        </p>
      ) : null}

      {props.items.map((item) => {
        const sources =
          item.candidate?.field_sources ?? item.current?.field_sources
        return (
          <div
            key={item.fingerprint}
            className='grid gap-3 rounded-lg border p-4 sm:grid-cols-[auto_minmax(0,1fr)]'
          >
            <Checkbox
              checked={selected.has(item.model)}
              onCheckedChange={(checked) =>
                toggle(item.model, checked === true)
              }
              disabled={props.isReviewing}
              aria-label={t('Select {{model}}', { model: item.model })}
            />
            <div className='min-w-0 space-y-3'>
              <div>
                <p className='font-medium'>{item.model}</p>
                <p className='text-muted-foreground text-sm'>{item.reason}</p>
                <p className='text-muted-foreground mt-1 text-xs break-all'>
                  {t('Candidate version')}: {item.candidate_version}
                </p>
                <p className='text-muted-foreground text-xs break-all'>
                  {t('Fingerprint')}: {item.fingerprint}
                </p>
              </div>
              <div className='grid gap-3 text-xs lg:grid-cols-2'>
                <PricingRecord
                  title={t('Current price')}
                  record={item.current}
                />
                <PricingRecord
                  title={t('Candidate price')}
                  record={item.candidate}
                />
              </div>
              {sources ? (
                <p className='text-muted-foreground text-xs break-words'>
                  {t('Field sources')}: {formatFieldSources(sources)}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PricingRecord(props: {
  title: string
  record?: AutoPricingPendingReview['candidate']
}) {
  return (
    <div className='bg-muted/40 min-w-0 p-3'>
      <p className='mb-2 font-medium'>{props.title}</p>
      <pre className='max-h-48 overflow-auto break-words whitespace-pre-wrap'>
        {props.record ? JSON.stringify(props.record, null, 2) : '-'}
      </pre>
    </div>
  )
}

function formatFieldSources(sources: Record<string, string>) {
  return Object.entries(sources)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, source]) => `${field}: ${source}`)
    .join(', ')
}
