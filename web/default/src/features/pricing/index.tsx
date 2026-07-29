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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { modelPricingConfig } from '@/features/home/model-pricing-config'
import { getLobeIcon } from '@/lib/lobe-icon'

import { ModelDetailsDrawer, PricingModelList } from './components'
import { EXCLUDED_GROUPS } from './constants'
import { usePricingData } from './hooks/use-pricing-data'
import { getModelUsableGroupRatios } from './lib/model-helpers'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null)
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )
  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const visibleVendors = useMemo(
    () =>
      vendors.filter((vendor) =>
        models.some((model) => model.vendor_id === vendor.id)
      ),
    [models, vendors]
  )
  const activeVendor = visibleVendors.some(
    (vendor) => String(vendor.id) === selectedVendor
  )
    ? selectedVendor
    : String(visibleVendors[0]?.id ?? '')
  const modelOrder = useMemo(
    () =>
      new Map<string, number>(
        modelPricingConfig.map((model, index) => [model.name, index])
      ),
    []
  )
  const vendorModels = useMemo(
    () =>
      models
        .filter((model) => String(model.vendor_id) === activeVendor)
        .sort((left, right) => {
          const leftOrder =
            modelOrder.get(left.model_name) ?? Number.MAX_SAFE_INTEGER
          const rightOrder =
            modelOrder.get(right.model_name) ?? Number.MAX_SAFE_INTEGER
          return (
            leftOrder - rightOrder ||
            left.model_name.localeCompare(right.model_name)
          )
        }),
    [activeVendor, modelOrder, models]
  )
  const ratioOptions = useMemo(() => {
    const groupsByRatio = new Map<number, Set<string>>()

    for (const model of vendorModels) {
      for (const group of model.enable_groups) {
        if (EXCLUDED_GROUPS.includes(group) || !(group in usableGroup)) continue
        const ratio = groupRatio[group]
        if (
          typeof ratio !== 'number' ||
          !Number.isFinite(ratio) ||
          ratio <= 0
        ) {
          continue
        }

        const groups = groupsByRatio.get(ratio) ?? new Set<string>()
        groups.add(group)
        groupsByRatio.set(ratio, groups)
      }
    }

    if (groupsByRatio.size === 0) {
      groupsByRatio.set(1, new Set())
    }

    return [...groupsByRatio.entries()]
      .sort(([left], [right]) => left - right)
      .map(([ratio, groups]) => ({
        ratio,
        groups: [...groups].sort((left, right) => left.localeCompare(right)),
      }))
  }, [groupRatio, usableGroup, vendorModels])
  const availableRatios = ratioOptions.map((option) => option.ratio)
  const activeRatio =
    selectedRatio !== null && availableRatios.includes(selectedRatio)
      ? selectedRatio
      : (availableRatios[0] ?? 1)
  const visibleModels = useMemo(
    () =>
      vendorModels
        .filter((model) =>
          getModelUsableGroupRatios(model, groupRatio, usableGroup).includes(
            activeRatio
          )
        )
        .sort((left, right) => {
          const leftOrder =
            modelOrder.get(left.model_name) ?? Number.MAX_SAFE_INTEGER
          const rightOrder =
            modelOrder.get(right.model_name) ?? Number.MAX_SAFE_INTEGER
          return (
            leftOrder - rightOrder ||
            left.model_name.localeCompare(right.model_name)
          )
        }),
    [
      activeRatio,
      groupRatio,
      modelOrder,
      usableGroup,
      vendorModels,
    ]
  )
  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? models.find((model) => model.model_name === selectedModelName) || null
        : null,
    [models, selectedModelName]
  )

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1500px] px-4 pt-24 pb-10 sm:px-6 lg:px-8'>
        {isLoading ? (
          <div className='space-y-5'>
            <Skeleton className='h-20 rounded-2xl' />
            <Skeleton className='h-[560px] rounded-2xl' />
          </div>
        ) : (
          <>
            <header className='mx-auto mb-8 max-w-3xl text-center sm:mb-10'>
              <h1 className='text-4xl leading-tight font-bold sm:text-5xl'>
                {t('Model Square')}
              </h1>
              <p className='text-muted-foreground mt-4 text-sm sm:text-base'>
                {t('This site currently has {{count}} models enabled', {
                  count: models.length,
                })}
              </p>
            </header>

            <Card size='sm' className='mb-5'>
              <CardHeader>
                <CardTitle>{t('Provider')}</CardTitle>
              </CardHeader>
              <CardContent className='flex flex-col gap-3'>
                <div className='overflow-x-auto overflow-y-hidden pb-1'>
                  <Tabs
                    value={activeVendor}
                    onValueChange={(value) => {
                      setSelectedVendor(value)
                      setSelectedRatio(null)
                    }}
                  >
                    <TabsList className='h-10 w-max justify-start'>
                      {visibleVendors.map((vendor) => (
                        <TabsTrigger
                          key={vendor.id}
                          value={String(vendor.id)}
                          className='h-9 flex-none px-4'
                        >
                          {vendor.icon && getLobeIcon(vendor.icon, 16)}
                          {vendor.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                {ratioOptions.length > 0 && (
                  <>
                    <Separator />
                    <div className='flex flex-col gap-2'>
                      <div className='text-muted-foreground text-xs font-medium'>
                        {t('Group')}
                      </div>
                      <div className='overflow-x-auto overflow-y-hidden pb-1'>
                        <Tabs
                          value={String(activeRatio)}
                          onValueChange={(value) =>
                            setSelectedRatio(Number(value))
                          }
                        >
                          <TabsList className='h-10 w-max justify-start'>
                            {ratioOptions.map((option) => (
                              <TabsTrigger
                                key={option.ratio}
                                value={String(option.ratio)}
                                className='h-9 flex-none gap-1 px-3'
                              >
                                {option.groups.length > 0 && (
                                  <span>{option.groups.join(' / ')}</span>
                                )}
                                <span className='font-mono'>
                                  ({option.ratio}x)
                                </span>
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {visibleModels.length > 0 ? (
              <PricingModelList
                models={visibleModels}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
                selectedRatio={activeRatio}
                onModelClick={setSelectedModelName}
              />
            ) : (
              <Empty className='rounded-xl border'>
                <EmptyHeader>
                  <EmptyTitle>{t('No Models Found')}</EmptyTitle>
                  <EmptyDescription>
                    {t('No models match your current filters.')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        )}

        {selectedModel && (
          <ModelDetailsDrawer
            open={Boolean(selectedModel)}
            onOpenChange={(open) => {
              if (!open) setSelectedModelName(null)
            }}
            model={selectedModel}
            groupRatio={groupRatio}
            usableGroup={usableGroup}
            endpointMap={
              endpointMap as Record<string, { path?: string; method?: string }>
            }
            autoGroups={autoGroups}
            priceRate={priceRate}
            usdExchangeRate={usdExchangeRate}
            tokenUnit='M'
            showRechargePrice
          />
        )}
      </PageTransition>
    </PublicLayout>
  )
}
