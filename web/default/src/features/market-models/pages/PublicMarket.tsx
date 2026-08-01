/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { useSeo } from '@/lib/seo'

import { getPublicMarketModels } from '../api'
import { MARKET_MODEL_STATUSES, formatMarketPrice } from '../constants'
import type { MarketModel, PublicMarketModelItem } from '../types'
import { marketingNavLinks } from '@/features/marketing/data/site'
import { useLocale } from '@/features/marketing/hooks/useLocale'
import { Section, SectionTitle } from '@/features/marketing/components/Section'

function getDisplayName(model: MarketModel, i18n: { name?: string } | null): string {
  return i18n?.name?.trim() || model.model
}

function getTags(model: MarketModel): string[] {
  if (!model.tags) return []
  return model.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

export function PublicMarket() {
  const locale = useLocale()
  const { t } = useTranslation()
  useSeo({
    title: t('Model Market'),
    description: t('Model market description'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['public-market-models', locale],
    queryFn: () => getPublicMarketModels(locale),
  })

  const items: PublicMarketModelItem[] = data ?? []

  return (
    <PublicLayout
      showMainContainer={false}
      navLinks={marketingNavLinks[locale]}
      showAuthButtons
      showThemeSwitch
    >
      <div className='pt-16'>
        <Section>
          <SectionTitle title={t('Model Market')} description={t('Model market description')} />

          {isLoading ? (
            <p className='text-center text-muted-foreground'>{t('Loading')}</p>
          ) : null}

          {!isLoading && items.length === 0 ? (
            <p className='text-center text-muted-foreground'>
              {locale === 'zh' ? '暂无可展示的模型。' : 'No models to display yet.'}
            </p>
          ) : null}

          {!isLoading && items.length > 0 ? (
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {items.map(({ model, i18n }) => {
                const statusConfig = MARKET_MODEL_STATUSES[model.status]
                const tags = getTags(model)
                const displayName = getDisplayName(model, i18n)
                return (
                  <Card
                    key={model.id}
                    className='border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-border'
                  >
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <CardTitle className='text-lg'>{displayName}</CardTitle>
                        {model.featured && (
                          <StatusBadge
                            label={t('Featured')}
                            variant='info'
                            size='sm'
                            copyable={false}
                            className='shrink-0'
                          />
                        )}
                      </div>
                      <div className='mt-2 flex flex-wrap items-center gap-1'>
                        <StatusBadge
                          label={model.category}
                          variant='purple'
                          size='sm'
                          copyable={false}
                        />
                        {statusConfig && (
                          <StatusBadge
                            label={t(statusConfig.labelKey)}
                            variant={statusConfig.variant}
                            size='sm'
                            copyable={false}
                          />
                        )}
                        {tags.map((tag) => (
                          <StatusBadge
                            key={tag}
                            label={tag}
                            variant='neutral'
                            size='sm'
                            copyable={false}
                          />
                        ))}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {i18n?.description ? (
                        <p className='text-sm text-muted-foreground'>{i18n.description}</p>
                      ) : null}

                      <div className='mt-4 grid grid-cols-2 gap-3'>
                        <div>
                          <p className='text-xs text-muted-foreground'>{t('Input')}</p>
                          <p className='text-sm font-medium'>
                            {formatMarketPrice(model.input_price, model.currency)}
                            <span className='ml-1 text-xs font-normal text-muted-foreground'>
                              / {model.unit}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className='text-xs text-muted-foreground'>{t('Output')}</p>
                          <p className='text-sm font-medium'>
                            {formatMarketPrice(model.output_price, model.currency)}
                            <span className='ml-1 text-xs font-normal text-muted-foreground'>
                              / {model.unit}
                            </span>
                          </p>
                        </div>
                      </div>

                      {model.trial_quota > 0 && (
                        <p className='mt-3 text-xs text-muted-foreground'>
                          {t('Trial quota')}: {model.trial_quota} {model.unit}
                        </p>
                      )}
                    </CardContent>

                    <CardFooter>
                      <a
                        href='/pricing'
                        className='text-sm font-medium text-info hover:underline'
                      >
                        {t('View pricing')} →
                      </a>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : null}
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
