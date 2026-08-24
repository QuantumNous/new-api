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
import { useMemo, useState, type ReactNode } from 'react'
import { InformationCircleIcon, PackageIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ALL_MODEL_VENDORS,
  createModelVendorFilterState,
  filterModelAccessModels,
  getModelVendorFilters,
  reconcileModelVendorFilterState,
  UNLABELLED_MODEL_VENDOR,
  type ModelVendorFilter,
} from '../lib/model-access-browser'
import type { ModelAccessModel } from '../types'
import { ModelAccessList } from './model-access-list'

export type ModelAccessPreviewProps = {
  defaultRatio: number | null
  emptyDescription?: string
  emptyTitle?: string
  headerAction?: ReactNode
  models: ModelAccessModel[]
  modelRatios: Readonly<Record<string, number>>
  scopeDescription?: string
  scopeKey?: string
  scopeTitle: string
  summary?: string
  totalCount: number
}

export function ModelAccessPreview(props: ModelAccessPreviewProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const vendorFilters = useMemo(
    () => getModelVendorFilters(props.models),
    [props.models]
  )
  const vendorScopeKey = props.scopeKey ?? props.scopeTitle
  const [vendorState, setVendorState] = useState(() =>
    createModelVendorFilterState(vendorFilters, vendorScopeKey)
  )
  const reconciledVendorState = reconcileModelVendorFilterState(
    vendorFilters,
    vendorScopeKey,
    vendorState
  )
  if (reconciledVendorState !== vendorState) {
    setVendorState(reconciledVendorState)
  }
  const activeVendor = reconciledVendorState.value

  const visibleModels = useMemo(
    () => filterModelAccessModels(props.models, query, activeVendor),
    [activeVendor, props.models, query]
  )

  const clearFilters = () => {
    setQuery('')
    setVendorState(createModelVendorFilterState(vendorFilters, vendorScopeKey))
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='flex min-w-0 items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='truncate text-sm font-semibold'>{props.scopeTitle}</h3>
          {props.scopeDescription && (
            <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>
              {props.scopeDescription}
            </p>
          )}
        </div>
        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          <Badge variant='secondary'>
            {props.summary ??
              t('{{effective}} / {{total}} models', {
                effective: props.models.length,
                total: props.totalCount,
              })}
          </Badge>
          {props.headerAction}
        </div>
      </div>

      <Alert>
        <HugeiconsIcon
          icon={InformationCircleIcon}
          strokeWidth={2}
          aria-hidden='true'
        />
        <AlertTitle>{t('Strict scope preview')}</AlertTitle>
        <AlertDescription>
          <p>
            {t(
              'Only models available in this API key scope are shown. Temporary failures remain listed.'
            )}
          </p>
          <p>
            {t(
              'This shows the strict model scope for the current configuration. Actual requests may still be affected by API key status, quota, IP restrictions, and channel status.'
            )}
          </p>
        </AlertDescription>
      </Alert>

      <div className='bg-card flex flex-col gap-2.5 rounded-xl border p-3'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-muted-foreground text-xs' aria-live='polite'>
            {t('{{visible}} / {{effective}} models shown', {
              visible: visibleModels.length,
              effective: props.models.length,
            })}
          </p>
          <Input
            className='w-full sm:w-56'
            value={query}
            aria-label={t('Search models')}
            placeholder={t('Search models')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Model vendors')}
          </span>
          <div className='overflow-x-auto pb-0.5'>
            <ToggleGroup
              value={[activeVendor]}
              variant='outline'
              size='sm'
              aria-label={t('Model vendors')}
              onValueChange={(values) => {
                if (values[0]) {
                  setVendorState(
                    createModelVendorFilterState(
                      vendorFilters,
                      vendorScopeKey,
                      values[0] as ModelVendorFilter
                    )
                  )
                }
              }}
            >
              {vendorFilters.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.value === ALL_MODEL_VENDORS
                    ? t('All')
                    : option.value === UNLABELLED_MODEL_VENDOR
                      ? t('Unlabelled vendor')
                      : option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      {props.models.length === 0 ? (
        <Empty className='min-h-64 border'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <HugeiconsIcon
                icon={PackageIcon}
                strokeWidth={2}
                aria-hidden='true'
              />
            </EmptyMedia>
            <EmptyTitle>
              {props.emptyTitle ?? t('No models available to this API key')}
            </EmptyTitle>
            <EmptyDescription>
              {props.emptyDescription ??
                t('Review the API key and model access settings.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ModelAccessList
          defaultRatio={props.defaultRatio}
          modelRatios={props.modelRatios}
          models={visibleModels}
          scopeIsEmpty={false}
          onClearFilters={clearFilters}
        />
      )}
    </div>
  )
}
