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
import {
  Package01Icon,
  RefreshIcon,
  ShoppingCartAdd01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentOffers } from '../api'
import { formatAgentPoints } from '../lib/money'
import {
  agentQueryKeys,
  agentUserQueryKey,
  getAgentQueryView,
} from '../lib/workspace'
import type { AgentOffer } from '../types'
import { PurchaseDialog } from './purchase-dialog'

export function AgentOffers() {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const [selectedOffer, setSelectedOffer] = useState<AgentOffer | null>(null)
  const query = useQuery({
    queryKey: agentUserQueryKey(agentQueryKeys.offers, userID),
    queryFn: async () => {
      const response = await getAgentOffers()
      if (!response.success) throw new Error('Agent offers unavailable')
      return response.data
    },
  })
  const view = getAgentQueryView({
    loading: query.isPending,
    error: Boolean(query.error),
    hasData: Boolean(query.data?.length),
  })
  let offersContent: ReactNode

  if (view === 'loading') {
    offersContent = (
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-48' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-24' />
            </CardContent>
            <CardFooter>
              <Skeleton className='h-8 w-full' />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  } else if (view === 'error') {
    offersContent = (
      <Empty className='min-h-52 border'>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load package offers')}</EmptyTitle>
          <EmptyDescription>
            {t('Try loading the package offers again.')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type='button'
            variant='outline'
            onClick={() => query.refetch()}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              data-icon='inline-start'
            />
            {t('Retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  } else if (view === 'data' && query.data) {
    offersContent = (
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {query.data.map((offer) => (
          <Card key={offer.id}>
            <CardHeader>
              <CardTitle>{offer.plan.title}</CardTitle>
              <CardDescription>
                {offer.plan.subtitle || t('Subscription package code')}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              <div>
                <span className='text-2xl font-semibold tabular-nums'>
                  {formatAgentPoints(offer.unit_price)}
                </span>{' '}
                <span className='text-muted-foreground'>
                  {t('points per code')}
                </span>
              </div>
              <div className='text-muted-foreground text-sm'>
                {t('Code validity: {{days}} days', {
                  days: offer.code_valid_days,
                })}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type='button'
                className='w-full'
                onClick={() => setSelectedOffer(offer)}
              >
                <HugeiconsIcon
                  icon={ShoppingCartAdd01Icon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
                {t('Purchase codes')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  } else {
    offersContent = (
      <Empty className='min-h-52 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>{t('No package offers available')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'An administrator must enable a package offer before it can be purchased.'
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <section
      className='flex flex-col gap-3'
      aria-labelledby='agent-offers-heading'
    >
      <div>
        <h3 id='agent-offers-heading' className='text-base font-semibold'>
          {t('Package offers')}
        </h3>
        <p className='text-muted-foreground text-sm'>
          {t('Purchase codes backed by the current subscription plans.')}
        </p>
      </div>

      {offersContent}

      <PurchaseDialog
        offer={selectedOffer}
        open={selectedOffer !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOffer(null)
        }}
      />
    </section>
  )
}
