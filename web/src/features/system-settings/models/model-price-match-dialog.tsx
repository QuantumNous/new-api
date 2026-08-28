/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { fetchUpstreamRatios } from '../api'
import {
  OPENROUTER_PRESET_BASE_URL,
  OPENROUTER_PRESET_ENDPOINT,
  OPENROUTER_PRESET_ID,
  OPENROUTER_PRESET_NAME,
} from './constants'
import {
  findModelPriceMatches,
  type ModelPriceMatch,
  type PriceMatchKind,
} from './model-price-matching'
import { formatPricingNumber } from './pricing-format'

type ModelPriceMatchDialogProps = {
  modelName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (match: ModelPriceMatch) => boolean | void | Promise<boolean | void>
}

const matchLabelKeys: Record<PriceMatchKind, string> = {
  exact: 'Exact match',
  normalized: 'Normalized match',
  fuzzy: 'Fuzzy match',
}

export function ModelPriceMatchDialog(
  props: ModelPriceMatchDialogProps
): ReactNode {
  const { t } = useTranslation()
  const [selectedSourceModel, setSelectedSourceModel] = useState('')
  const [isApplying, setIsApplying] = useState(false)

  const matchesQuery = useQuery({
    queryKey: ['openrouter-price-matches'],
    staleTime: 5 * 60 * 1000,
    enabled: props.open && Boolean(props.modelName),
    queryFn: async () => {
      const response = await fetchUpstreamRatios({
        upstreams: [
          {
            id: OPENROUTER_PRESET_ID,
            name: OPENROUTER_PRESET_NAME,
            base_url: OPENROUTER_PRESET_BASE_URL,
            endpoint: OPENROUTER_PRESET_ENDPOINT,
          },
        ],
        timeout: 10,
      })
      if (!response.success) {
        throw new Error(
          response.message || t('Failed to fetch upstream prices')
        )
      }
      return response.data.differences
    },
  })

  const matches = useMemo(
    () =>
      props.modelName && matchesQuery.data
        ? findModelPriceMatches(props.modelName, matchesQuery.data)
        : [],
    [matchesQuery.data, props.modelName]
  )
  const firstSourceModel = matches[0]?.sourceModel ?? ''

  useEffect(() => {
    setSelectedSourceModel(firstSourceModel)
  }, [firstSourceModel])

  const selectedMatch = matches.find(
    (match) => match.sourceModel === selectedSourceModel
  )

  const handleApply = async (): Promise<void> => {
    if (!selectedMatch) return
    setIsApplying(true)
    try {
      const applied = await props.onApply(selectedMatch)
      if (applied === false) return
      props.onOpenChange(false)
    } finally {
      setIsApplying(false)
    }
  }

  let matchesContent: ReactNode
  if (matchesQuery.isLoading) {
    matchesContent = (
      <div className='text-muted-foreground flex min-h-56 items-center justify-center gap-2'>
        <Spinner />
        {t('Finding price matches...')}
      </div>
    )
  } else if (matchesQuery.isError) {
    const errorMessage =
      matchesQuery.error instanceof Error
        ? matchesQuery.error.message
        : t('Failed to fetch upstream prices')
    matchesContent = (
      <Empty className='min-h-56 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Search />
          </EmptyMedia>
          <EmptyTitle>{t('Failed to find price matches')}</EmptyTitle>
          <EmptyDescription>{errorMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (matches.length === 0) {
    matchesContent = (
      <Empty className='min-h-56 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Search />
          </EmptyMedia>
          <EmptyTitle>{t('No possible price matches found')}</EmptyTitle>
          <EmptyDescription>
            {t('Try configuring this model price manually.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    matchesContent = (
      <ScrollArea className='h-[min(55vh,440px)] pr-3'>
        <RadioGroup
          value={selectedSourceModel}
          onValueChange={setSelectedSourceModel}
          aria-label={t('Possible price matches')}
        >
          {matches.map((match) => {
            const selected = match.sourceModel === selectedSourceModel
            const inputPrice = match.ratio * 2
            const outputPrice =
              match.completionRatio === undefined
                ? undefined
                : inputPrice * match.completionRatio

            return (
              <Label
                key={match.sourceModel}
                htmlFor={`price-match-${match.sourceModel}`}
                className={cn(
                  'hover:border-primary/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors',
                  selected && 'border-primary ring-primary ring-1'
                )}
              >
                <RadioGroupItem
                  id={`price-match-${match.sourceModel}`}
                  value={match.sourceModel}
                  className='mt-1'
                />
                <div className='min-w-0 flex-1 space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='truncate font-medium'>
                      {match.sourceModel}
                    </span>
                    <StatusBadge
                      label={t(matchLabelKeys[match.kind])}
                      variant={match.kind === 'fuzzy' ? 'warning' : 'success'}
                      copyable={false}
                    />
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {t('{{score}}% similar', {
                        score: Math.round(match.score * 100),
                      })}
                    </span>
                  </div>
                  <div className='grid gap-1 text-sm sm:grid-cols-3'>
                    <span>
                      {t('Input')}: ${formatPricingNumber(inputPrice)} / 1M
                    </span>
                    <span>
                      {t('Output')}:{' '}
                      {outputPrice === undefined
                        ? t('Not provided')
                        : `$${formatPricingNumber(outputPrice)} / 1M`}
                    </span>
                    <span>
                      {t('Model ratio')}: {formatPricingNumber(match.ratio)}
                    </span>
                  </div>
                </div>
              </Label>
            )
          })}
        </RadioGroup>
      </ScrollArea>
    )
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Choose a matching price')}</DialogTitle>
          <DialogDescription>
            {t(
              'Review exact and fuzzy matches for {{model}}, then choose the best price.',
              { model: props.modelName ?? '' }
            )}
          </DialogDescription>
        </DialogHeader>

        {matchesContent}

        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleApply} disabled={!selectedMatch || isApplying}>
            {isApplying && <Spinner data-icon='inline-start' />}
            {t('Apply selected price')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
