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
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import { QUOTA_TYPE_VALUES } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel } from '../types'

type PricingModelListProps = {
  models: PricingModel[]
  priceRate: number
  usdExchangeRate: number
  selectedRatio: number
  onModelClick: (modelName: string) => void
}

type PriceMetric = {
  label: string
  value: string
  unit: string
  accent?: boolean
}

export function PricingModelList(props: PricingModelListProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b py-3 md:grid md:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.8fr)] md:gap-5 lg:px-6'>
        <CardTitle>{t('Models')}</CardTitle>
        <CardTitle className='hidden md:block'>{t('Pricing')}</CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <ItemGroup className='gap-0'>
          {props.models.map((model, modelIndex) => {
            const selectedGroup = model.enable_groups.find(
              (group) => model.group_ratio?.[group] === props.selectedRatio
            )
            const dynamicSummary = getDynamicPricingSummary(model, {
              tokenUnit: 'M',
              showRechargePrice: true,
              priceRate: props.priceRate,
              usdExchangeRate: props.usdExchangeRate,
              groupRatioMultiplier: getDynamicDisplayGroupRatio(
                model,
                selectedGroup
              ),
            })
            let metrics: PriceMetric[] = []

            if (dynamicSummary && !dynamicSummary.isSpecialExpression) {
              metrics = dynamicSummary.entries
                .slice(0, 4)
                .map((entry, index) => ({
                  label: t(entry.shortLabel),
                  value: entry.formatted,
                  unit: '/M Token',
                  accent: index < 2,
                }))
            } else if (model.quota_type === QUOTA_TYPE_VALUES.TOKEN) {
              metrics = [
                {
                  label: t('Input'),
                  value: formatPrice(
                    model,
                    'input',
                    'M',
                    true,
                    props.priceRate,
                    props.usdExchangeRate,
                    selectedGroup
                  ),
                  unit: '/M Token',
                  accent: true,
                },
                {
                  label: t('Output'),
                  value: formatPrice(
                    model,
                    'output',
                    'M',
                    true,
                    props.priceRate,
                    props.usdExchangeRate,
                    selectedGroup
                  ),
                  unit: '/M Token',
                  accent: true,
                },
              ]

              if (model.create_cache_ratio != null) {
                metrics.push({
                  label: t('Create Cache'),
                  value: formatPrice(
                    model,
                    'create_cache',
                    'M',
                    true,
                    props.priceRate,
                    props.usdExchangeRate,
                    selectedGroup
                  ),
                  unit: '/M Token',
                })
              }
              if (model.cache_ratio != null) {
                metrics.push({
                  label: t('Cached'),
                  value: formatPrice(
                    model,
                    'cache',
                    'M',
                    true,
                    props.priceRate,
                    props.usdExchangeRate,
                    selectedGroup
                  ),
                  unit: '/M Token',
                })
              }
            } else {
              metrics = [
                {
                  label: t('Price'),
                  value: formatRequestPrice(
                    model,
                    true,
                    props.priceRate,
                    props.usdExchangeRate,
                    selectedGroup
                  ),
                  unit: `/ ${t('request')}`,
                  accent: true,
                },
              ]
            }

            return (
              <div key={model.model_name}>
                <Item className='hover:bg-muted/30 grid gap-4 rounded-none px-4 py-4 md:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.8fr)] md:gap-5 lg:px-6'>
                  <ItemContent className='min-w-0 justify-center gap-2'>
                    <ItemTitle className='max-w-full gap-1.5'>
                      <button
                        type='button'
                        className='focus-visible:ring-ring truncate rounded-md font-mono text-base font-semibold outline-none focus-visible:ring-2'
                        onClick={() => props.onModelClick(model.model_name)}
                      >
                        {model.model_name}
                      </button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='text-muted-foreground size-7 shrink-0 rounded-full'
                        aria-label={t('Copy')}
                        onClick={() => copyToClipboard(model.model_name)}
                      >
                        <Copy aria-hidden='true' />
                      </Button>
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions className='grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-4'>
                    {metrics.map((metric) => (
                      <div
                        key={`${model.model_name}-${metric.label}`}
                        className={cn(
                          'min-w-0 border-l pl-3',
                          metric.accent && 'border-primary'
                        )}
                      >
                        <Badge variant='secondary'>{metric.label}</Badge>
                        <div className='mt-1.5 flex flex-wrap items-baseline gap-1 font-mono tabular-nums'>
                          <span className='text-base font-semibold'>
                            {metric.value}
                          </span>
                          <span className='text-muted-foreground text-xs font-normal'>
                            {metric.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </ItemActions>
                </Item>
                {modelIndex < props.models.length - 1 && <Separator />}
              </div>
            )
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
