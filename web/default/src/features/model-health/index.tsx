/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SectionPageLayout } from '@/components/layout'
import { ModelHealthDetailSheet } from './components/detail-sheet'
import { FleetTable } from './components/fleet-table'
import { SummaryCards } from './components/summary-cards'
import {
  DataQualityBanner,
  ModelHealthEmpty,
  ModelHealthError,
  ModelHealthSkeleton,
} from './components/view-states'
import {
  useModelHealthOverview,
  useRefreshModelHealth,
} from './hooks/use-model-health'
import { getModelHealthViewState, windowLabelKey } from './lib'
import type { ModelHealthOverview, ModelHealthWindow } from './types'

const WINDOWS: ModelHealthWindow[] = [24, 168, 720]

function OverviewContent(props: {
  overview: ModelHealthOverview
  onSelectModel: (model: string) => void
}) {
  if (!props.overview.collection_enabled) {
    return <ModelHealthEmpty collectionEnabled={false} />
  }
  if (props.overview.models.length === 0) {
    return <ModelHealthEmpty collectionEnabled />
  }
  return (
    <>
      <SummaryCards fleet={props.overview.fleet} />
      <FleetTable
        models={props.overview.models}
        onSelectModel={props.onSelectModel}
      />
    </>
  )
}

export function ModelHealth() {
  const { t } = useTranslation()
  const [hours, setHours] = useState<ModelHealthWindow>(24)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const overviewQuery = useModelHealthOverview(hours)
  const refresh = useRefreshModelHealth()
  const viewState = getModelHealthViewState({
    hasData: overviewQuery.data !== undefined,
    isError: overviewQuery.isError,
    isLoading: overviewQuery.isLoading,
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3'>
          <span>{t('Model Health')}</span>
          <span className='text-muted-foreground truncate text-xs font-normal'>
            {t('Persisted database observations · best effort')}
          </span>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <ToggleGroup
          value={[String(hours)]}
          variant='outline'
          size='sm'
          aria-label={t('Health time window')}
          onValueChange={(values) => {
            const next = Number(values[0])
            if (next === 24 || next === 168 || next === 720) setHours(next)
          }}
        >
          {WINDOWS.map((windowHours) => (
            <ToggleGroupItem key={windowHours} value={String(windowHours)}>
              {t(windowLabelKey(windowHours))}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          variant='outline'
          size='sm'
          disabled={overviewQuery.isFetching}
          onClick={() => void refresh()}
        >
          {overviewQuery.isFetching ? t('Refreshing…') : t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {viewState === 'loading' && <ModelHealthSkeleton />}
        {viewState === 'error' && (
          <ModelHealthError
            isFetching={overviewQuery.isFetching}
            onRetry={() => void overviewQuery.refetch()}
          />
        )}
        {overviewQuery.data && (
          <div className='flex flex-col gap-4'>
            {viewState === 'data-with-refetch-error' && (
              <ModelHealthError
                isFetching={overviewQuery.isFetching}
                onRetry={() => void overviewQuery.refetch()}
              />
            )}
            <DataQualityBanner overview={overviewQuery.data} hours={hours} />
            <OverviewContent
              overview={overviewQuery.data}
              onSelectModel={setSelectedModel}
            />
          </div>
        )}
        <ModelHealthDetailSheet
          model={
            overviewQuery.data?.collection_enabled === false
              ? null
              : selectedModel
          }
          hours={hours}
          onOpenChange={(open) => {
            if (!open) setSelectedModel(null)
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
