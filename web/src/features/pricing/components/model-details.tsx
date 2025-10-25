import { useMemo } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
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
    <div className='border-b pb-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='mb-2 flex items-center gap-2'>
            <h1 className='text-3xl font-semibold'>{model.model_name}</h1>
            <CopyButton
              value={model.model_name || ''}
              className='size-8'
              iconClassName='size-4'
              tooltip='Copy model name'
              successTooltip='Copied!'
              aria-label='Copy model name'
            />
          </div>
          {model.vendor_name && (
            <p className='text-muted-foreground'>by {model.vendor_name}</p>
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
    <div className='space-y-4 border-b py-6'>
      <div>
        <h2 className='mb-3 text-xl font-semibold'>Overview</h2>
        <p className='text-muted-foreground leading-relaxed'>{description}</p>
      </div>

      {tags.length > 0 && (
        <div className='flex flex-wrap gap-2'>
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
    <div className='space-y-3 border-b py-6'>
      <h2 className='text-xl font-semibold'>API Endpoints</h2>
      <div className='space-y-2'>
        {endpoints.map(({ type, path, method }) => (
          <div key={type} className='rounded-md border p-3'>
            <div className='mb-1 flex items-center justify-between'>
              <span className='font-medium'>{type}</span>
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
              <code className='text-muted-foreground block text-sm break-all'>
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
}: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
}) {
  const availableGroups = useMemo(() => {
    return getAvailableGroups(model, usableGroup || {})
  }, [model, usableGroup])

  const isTokenBased = isTokenBasedModel(model)

  // Show message if no groups available
  if (availableGroups.length === 0) {
    return (
      <div className='space-y-3 py-6'>
        <h2 className='text-xl font-semibold'>Pricing by Group</h2>
        <div className='border-border/40 text-muted-foreground rounded-lg border p-6 text-center'>
          <p className='text-sm'>
            This model is not available in any group, or no group pricing
            information is configured.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3 py-6'>
      <h2 className='text-xl font-semibold'>Pricing by Group</h2>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b'>
              <th className='pr-4 pb-3 text-left font-medium'>Group</th>
              <th className='pr-4 pb-3 text-left font-medium'>Ratio</th>
              {isTokenBased ? (
                <>
                  <th className='pr-4 pb-3 text-right font-medium'>
                    Input / 1M tokens
                  </th>
                  <th className='pb-3 text-right font-medium'>
                    Output / 1M tokens
                  </th>
                </>
              ) : (
                <th className='pb-3 text-right font-medium'>Price / request</th>
              )}
            </tr>
          </thead>
          <tbody>
            {availableGroups.map((group) => {
              const ratio = groupRatio[group] || 1
              return (
                <tr key={group} className='border-b last:border-0'>
                  <td className='py-3 pr-4'>
                    <StatusBadge
                      label={group}
                      autoColor={group}
                      size='sm'
                      copyable={false}
                    />
                  </td>
                  <td className='py-3 pr-4'>
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
                      <td className='py-3 pr-4 text-right font-mono'>
                        {formatGroupPrice(
                          model,
                          group,
                          'input',
                          'USD',
                          'M',
                          false,
                          1,
                          1,
                          groupRatio
                        )}
                      </td>
                      <td className='py-3 text-right font-mono'>
                        {formatGroupPrice(
                          model,
                          group,
                          'output',
                          'USD',
                          'M',
                          false,
                          1,
                          1,
                          groupRatio
                        )}
                      </td>
                    </>
                  ) : (
                    <td className='py-3 text-right font-mono'>
                      {formatFixedPrice(
                        model,
                        group,
                        'USD',
                        false,
                        1,
                        1,
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
  const navigate = useNavigate()

  const { models, groupRatio, usableGroup, endpointMap, isLoading } =
    usePricingData()

  const model = useMemo(() => {
    if (!models || !modelId) return null
    return models.find((m) => m.model_name === modelId) || null
  }, [models, modelId])

  const handleBack = () => {
    navigate({ to: '/pricing' })
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
          <h2 className='mb-2 text-xl font-semibold'>Model not found</h2>
          <p className='text-muted-foreground mb-4'>
            The model you're looking for doesn't exist.
          </p>
          <Button onClick={handleBack} variant='outline'>
            Back to Models
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl px-4 sm:px-6'>
        <Button variant='ghost' size='sm' onClick={handleBack} className='mb-6'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back
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
        />
      </div>
    </PublicLayout>
  )
}
