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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { useModelStatus } from '@/features/status/api'
import { cn } from '@/lib/utils'

import {
  LoadingSkeleton,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { usePricingData } from './hooks/use-pricing-data'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const {
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()
  const statusQuery = useModelStatus()
  const statusModels = statusQuery.data?.data?.models ?? []
  const downCount = statusModels.filter(
    (model) => model.probe.checked && !model.probe.alive
  ).length
  const allOperational = statusModels.length > 0 && downCount === 0

  const sortedModels = useMemo(
    () =>
      [...(models || [])].sort((a, b) =>
        (a.model_name || '').localeCompare(b.model_name || '')
      ),
    [models]
  )

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1200px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode='card' />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        {/* Mezon-style purple radial background — matches the landing hero */}
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.68 0.18 280 / 75%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.55 0.26 293 / 45%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.62 0.15 285 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1200px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <header className='mx-auto mb-8 max-w-3xl pt-5 text-center sm:mb-12 sm:pt-10'>
            <h1 className='bg-gradient-to-r from-landing-primary via-landing-accent to-landing-accent-hot bg-clip-text text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.15] font-bold tracking-tight text-transparent'>
              {t('Model Square')}
            </h1>
            <p className='text-muted-foreground/80 mt-3 text-sm sm:mt-4 sm:text-base'>
              {t('This site currently has {{count}} models enabled', {
                count: models?.length || 0,
              })}
            </p>
            {!statusQuery.isLoading && statusModels.length > 0 && (
              <p
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                  allOperational
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    allOperational ? 'bg-emerald-500' : 'bg-red-500'
                  )}
                />
                {allOperational
                  ? t('All Systems Operational')
                  : t('{{count}} model(s) down', { count: downCount })}
              </p>
            )}
          </header>

          <main className='min-w-0'>
            <ModelCardGrid
              models={sortedModels}
              onModelClick={handleModelClick}
              priceRate={priceRate}
              usdExchangeRate={usdExchangeRate}
            />
          </main>

          {selectedModel && (
            <ModelDetailsDrawer
              open={Boolean(selectedModel)}
              onOpenChange={(open) => {
                if (!open) setSelectedModelName(null)
              }}
              model={selectedModel}
              groupRatio={groupRatio || {}}
              usableGroup={usableGroup || {}}
              endpointMap={
                (endpointMap as Record<
                  string,
                  { path?: string; method?: string }
                >) || {}
              }
              autoGroups={autoGroups || []}
              priceRate={priceRate ?? 1}
              usdExchangeRate={usdExchangeRate ?? 1}
              tokenUnit='M'
              showRechargePrice={false}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
