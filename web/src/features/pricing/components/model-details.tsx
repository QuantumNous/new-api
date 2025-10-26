import { useMemo } from 'react'
import { useParams, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { usePricingData } from '../hooks/use-pricing-data'
import { parseTags } from '../lib/filters'
import {
  getAvailableGroups,
  replaceModelInPath,
  isTokenBasedModel,
} from '../lib/model-helpers'
import { formatGroupPrice, formatFixedPrice } from '../lib/price'
import type { PricingModel } from '../types'

function ModelHeader({ model }: { model: PricingModel }) {
  return (
    <div className='border-b pb-4 sm:pb-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='mb-2 flex items-center gap-2'>
            <h1 className='text-xl font-semibold sm:text-2xl lg:text-3xl'>
              {model.model_name}
            </h1>
            <CopyButton
              value={model.model_name || ''}
              className='size-7 sm:size-8'
              iconClassName='size-3.5 sm:size-4'
              tooltip='Copy model name'
              successTooltip='Copied!'
              aria-label='Copy model name'
            />
          </div>
          {model.vendor_name && (
            <p className='text-muted-foreground text-sm sm:text-base'>
              by {model.vendor_name}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function BasicInfoSection({ model }: { model: PricingModel }) {
  const description =
    model.description || model.vendor_description || 'No description available'

  const tags = parseTags(model.tags)

  return (
    <div className='space-y-3 border-b py-4 sm:space-y-4 sm:py-6'>
      <div>
        <h2 className='mb-2 text-lg font-semibold sm:mb-3 sm:text-xl'>
          Overview
        </h2>
        <p className='text-muted-foreground text-sm leading-relaxed sm:text-base'>
          {description}
        </p>
      </div>

      {tags.length > 0 && (
        <div className='flex flex-wrap gap-1.5 sm:gap-2'>
          {tags.map((tag) => (
            <StatusBadge
              key={tag}
              label={tag}
              autoColor={tag}
              size='sm'
              copyable={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EndpointsSection({
  model,
  endpointMap,
}: {
  model: PricingModel
  endpointMap: Record<string, { path?: string; method?: string }>
}) {
  const endpoints = useMemo(() => {
    const types = model.supported_endpoint_types || []
    return types.map((type) => {
      const info = endpointMap[type] || {}
      let path = info.path || ''
      if (path.includes('{model}')) {
        path = replaceModelInPath(path, model.model_name || '')
      }
      const method = info.method || 'POST'
      return { type, path, method }
    })
  }, [model, endpointMap])

  if (endpoints.length === 0) {
    return null
  }

  return (
    <div className='space-y-2 border-b py-4 sm:space-y-3 sm:py-6'>
      <h2 className='text-lg font-semibold sm:text-xl'>API Endpoints</h2>
      <div className='space-y-2'>
        {endpoints.map(({ type, path, method }) => (
          <div key={type} className='rounded-md border p-2.5 sm:p-3'>
            <div className='mb-1 flex items-center justify-between'>
              <span className='text-sm font-medium sm:text-base'>{type}</span>
              {path && (
                <StatusBadge
                  label={method}
                  variant='neutral'
                  size='sm'
                  copyable={false}
                  className='font-mono'
                />
              )}
            </div>
            {path && (
              <code className='text-muted-foreground block text-xs break-all sm:text-sm'>
                {path}
              </code>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupPricingSection({
  model,
  groupRatio,
  usableGroup,
  priceRate,
  usdExchangeRate,
}: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  priceRate: number
  usdExchangeRate: number
}) {
  const availableGroups = useMemo(() => {
    return getAvailableGroups(model, usableGroup || {})
  }, [model, usableGroup])

  const isTokenBased = isTokenBasedModel(model)

  // Show message if no groups available
  if (availableGroups.length === 0) {
    return (
      <div className='space-y-2 py-4 sm:space-y-3 sm:py-6'>
        <h2 className='text-lg font-semibold sm:text-xl'>Pricing by Group</h2>
        <div className='border-border/40 text-muted-foreground rounded-lg border p-4 text-center sm:p-6'>
          <p className='text-xs sm:text-sm'>
            This model is not available in any group, or no group pricing
            information is configured.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-2 py-4 sm:space-y-3 sm:py-6'>
      <h2 className='text-lg font-semibold sm:text-xl'>Pricing by Group</h2>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs sm:text-sm'>
          <thead>
            <tr className='border-b'>
              <th className='pr-2 pb-2 text-left text-xs font-medium sm:pr-4 sm:pb-3 sm:text-sm'>
                Group
              </th>
              <th className='pr-2 pb-2 text-left text-xs font-medium sm:pr-4 sm:pb-3 sm:text-sm'>
                Ratio
              </th>
              {isTokenBased ? (
                <>
                  <th className='pr-2 pb-2 text-right text-xs font-medium sm:pr-4 sm:pb-3 sm:text-sm'>
                    Input / 1M tokens
                  </th>
                  <th className='pb-2 text-right text-xs font-medium sm:pb-3 sm:text-sm'>
                    Output / 1M tokens
                  </th>
                </>
              ) : (
                <th className='pb-2 text-right text-xs font-medium sm:pb-3 sm:text-sm'>
                  Price / request
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {availableGroups.map((group) => {
              const ratio = groupRatio[group] || 1
              return (
                <tr key={group} className='border-b last:border-0'>
                  <td className='py-2 pr-2 sm:py-3 sm:pr-4'>
                    <StatusBadge
                      label={group}
                      autoColor={group}
                      size='sm'
                      copyable={false}
                    />
                  </td>
                  <td className='py-2 pr-2 sm:py-3 sm:pr-4'>
                    <StatusBadge
                      label={`${ratio}x`}
                      variant='neutral'
                      size='sm'
                      copyable={false}
                      className='font-mono'
                    />
                  </td>
                  {isTokenBased ? (
                    <>
                      <td className='py-2 pr-2 text-right font-mono text-xs sm:py-3 sm:pr-4 sm:text-sm'>
                        {formatGroupPrice(
                          model,
                          group,
                          'input',
                          'M',
                          false,
                          priceRate,
                          usdExchangeRate,
                          groupRatio
                        )}
                      </td>
                      <td className='py-2 text-right font-mono text-xs sm:py-3 sm:text-sm'>
                        {formatGroupPrice(
                          model,
                          group,
                          'output',
                          'M',
                          false,
                          priceRate,
                          usdExchangeRate,
                          groupRatio
                        )}
                      </td>
                    </>
                  ) : (
                    <td className='py-2 text-right font-mono text-xs sm:py-3 sm:text-sm'>
                      {formatFixedPrice(
                        model,
                        group,
                        false,
                        priceRate,
                        usdExchangeRate,
                        groupRatio
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ModelDetails() {
  const { modelId } = useParams({ from: '/pricing/$modelId/' })
  const search = useSearch({ from: '/pricing/$modelId/' })
  const navigate = useNavigate()

  const {
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const model = useMemo(() => {
    if (!models || !modelId) return null
    return models.find((m) => m.model_name === modelId) || null
  }, [models, modelId])

  const handleBack = () => {
    navigate({
      to: '/pricing',
      search,
    })
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-4xl space-y-8'>
          <Skeleton className='h-9 w-24' />
          <div className='space-y-4'>
            <Skeleton className='h-10 w-96' />
            <Skeleton className='h-5 w-48' />
          </div>
          <div className='space-y-3'>
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-5/6' />
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (!model) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-4xl text-center'>
          <h2 className='mb-2 text-lg font-semibold sm:text-xl'>
            Model not found
          </h2>
          <p className='text-muted-foreground mb-4 text-sm sm:text-base'>
            The model you're looking for doesn't exist.
          </p>
          <Button onClick={handleBack} variant='outline' size='sm'>
            Back to Models
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl px-4 sm:px-6'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleBack}
          className='mb-4 sm:mb-6'
        >
          <ArrowLeft className='mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4' />
          <span className='text-sm sm:text-base'>Back</span>
        </Button>

        <ModelHeader model={model} />

        <BasicInfoSection model={model} />

        <EndpointsSection
          model={model}
          endpointMap={(endpointMap as any) || {}}
        />

        <GroupPricingSection
          model={model}
          groupRatio={groupRatio || {}}
          usableGroup={usableGroup || {}}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
        />
      </div>
    </PublicLayout>
  )
}
