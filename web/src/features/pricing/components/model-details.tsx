import { useMemo } from 'react'
import { useParams, useSearch, useNavigate, Link } from '@tanstack/react-router'
import { ArrowLeft, Copy, Link2, DollarSign } from 'lucide-react'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PublicLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { usePricingData } from '../hooks/use-pricing-data'
import type { PricingModel } from '../type'
import { formatGroupPrice, formatFixedPrice } from '../utils/price-calculator'

function ModelHeader({ model }: { model: PricingModel }) {
  const { copyToClipboard } = useCopyToClipboard()

  const getModelIcon = () => {
    if (model.vendor_icon) {
      return (
        <div className='bg-muted flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm'>
          {getLobeIcon(model.vendor_icon, 40)}
        </div>
      )
    }

    const avatarText = model.model_name?.slice(0, 2).toUpperCase() || 'AI'
    return (
      <div className='bg-primary text-primary-foreground flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold shadow-sm'>
        {avatarText}
      </div>
    )
  }

  return (
    <div className='flex items-center gap-4'>
      {getModelIcon()}
      <div className='flex-1'>
        <div className='flex items-center gap-2'>
          <h1 className='text-2xl font-bold'>{model.model_name}</h1>
          <button
            onClick={() => copyToClipboard(model.model_name || '')}
            className='text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded transition-colors'
            title='Copy model name'
          >
            <Copy className='h-4 w-4' />
          </button>
        </div>
        {model.vendor_name && (
          <p className='text-muted-foreground text-sm'>
            by {model.vendor_name}
          </p>
        )}
      </div>
    </div>
  )
}

function BasicInfoSection({ model }: { model: PricingModel }) {
  const getModelDescription = () => {
    if (model.description) {
      return model.description
    }
    if (model.vendor_description) {
      return `Vendor info: ${model.vendor_description}`
    }
    return 'No description available'
  }

  const tags = useMemo(() => {
    if (!model.tags) return []
    return model.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }, [model.tags])

  return (
    <Card className='p-6'>
      <div className='mb-4 flex items-center gap-2'>
        <div className='bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg'>
          <span className='text-lg'>ℹ️</span>
        </div>
        <div>
          <h2 className='text-lg font-semibold'>Basic Information</h2>
          <p className='text-muted-foreground text-xs'>
            Detailed description and characteristics
          </p>
        </div>
      </div>

      <p className='text-foreground mb-4 leading-relaxed'>
        {getModelDescription()}
      </p>

      {tags.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {tags.map((tag, idx) => (
            <StatusBadge
              key={idx}
              label={tag}
              autoColor={tag}
              copyable={false}
              size='sm'
            />
          ))}
        </div>
      )}
    </Card>
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
        path = path.replace(/\{model\}/g, model.model_name || '')
      }
      const method = info.method || 'POST'
      return { type, path, method }
    })
  }, [model, endpointMap])

  if (endpoints.length === 0) {
    return null
  }

  return (
    <Card className='p-6'>
      <div className='mb-4 flex items-center gap-2'>
        <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400'>
          <Link2 className='h-4 w-4' />
        </div>
        <div>
          <h2 className='text-lg font-semibold'>API Endpoints</h2>
          <p className='text-muted-foreground text-xs'>
            Supported interface endpoint information
          </p>
        </div>
      </div>

      <div className='space-y-3'>
        {endpoints.map(({ type, path, method }, idx) => (
          <div key={type}>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex min-w-0 flex-1 items-start gap-2'>
                <div className='bg-success mt-1 h-2 w-2 flex-shrink-0 rounded-full' />
                <div className='min-w-0 flex-1'>
                  <div className='font-medium'>{type}</div>
                  {path && (
                    <div className='text-muted-foreground mt-1 text-sm break-all'>
                      {path}
                    </div>
                  )}
                </div>
              </div>
              {path && (
                <span className='text-muted-foreground flex-shrink-0 text-xs'>
                  {method}
                </span>
              )}
            </div>
            {idx < endpoints.length - 1 && <Separator className='mt-3' />}
          </div>
        ))}
      </div>
    </Card>
  )
}

function GroupPricingSection({
  model,
  groupRatio,
  usableGroup,
  autoGroups,
  currency,
  tokenUnit,
  showWithRecharge,
  priceRate,
  usdExchangeRate,
}: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  autoGroups: string[]
  currency: 'USD' | 'CNY'
  tokenUnit: 'M' | 'K'
  showWithRecharge: boolean
  priceRate: number
  usdExchangeRate: number
}) {
  const modelEnableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []

  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g))

  const availableGroups = useMemo(() => {
    return Object.keys(usableGroup || {})
      .filter((g) => g !== '' && g !== 'auto')
      .filter((g) => modelEnableGroups.includes(g))
  }, [usableGroup, modelEnableGroups])

  if (availableGroups.length === 0) {
    return null
  }

  return (
    <Card className='p-6'>
      <div className='mb-4 flex items-center gap-2'>
        <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400'>
          <DollarSign className='h-4 w-4' />
        </div>
        <div>
          <h2 className='text-lg font-semibold'>Group Pricing</h2>
          <p className='text-muted-foreground text-xs'>
            Pricing information for different user groups
          </p>
        </div>
      </div>

      {autoChain.length > 0 && (
        <div className='bg-muted mb-4 rounded-lg p-3'>
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            <span className='text-muted-foreground'>
              Auto group call chain:
            </span>
            {autoChain.map((g, idx) => (
              <div key={g} className='flex items-center gap-2'>
                <StatusBadge
                  label={`${g} group`}
                  variant='neutral'
                  copyable={false}
                />
                {idx < autoChain.length - 1 && (
                  <span className='text-muted-foreground'>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b'>
              <th className='pb-3 text-left font-semibold'>Group</th>
              <th className='pb-3 text-left font-semibold'>Ratio</th>
              <th className='pb-3 text-left font-semibold'>Billing Type</th>
              {model.quota_type === 0 ? (
                <>
                  <th className='pb-3 text-right font-semibold'>
                    Input
                    <div className='text-muted-foreground mt-1 text-xs font-normal'>
                      / {tokenUnit === 'K' ? '1K' : '1M'} tokens
                    </div>
                  </th>
                  <th className='pb-3 text-right font-semibold'>
                    Output
                    <div className='text-muted-foreground mt-1 text-xs font-normal'>
                      / {tokenUnit === 'K' ? '1K' : '1M'} tokens
                    </div>
                  </th>
                </>
              ) : (
                <th className='pb-3 text-right font-semibold'>
                  Price
                  <div className='text-muted-foreground mt-1 text-xs font-normal'>
                    / request
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {availableGroups.map((group) => {
              const ratio = groupRatio[group] || 1
              return (
                <tr key={group} className='border-b last:border-0'>
                  <td className='py-3'>
                    <StatusBadge
                      label={`${group} group`}
                      variant='neutral'
                      copyable={false}
                      size='sm'
                    />
                  </td>
                  <td className='py-3'>
                    <StatusBadge
                      label={`${ratio}x`}
                      variant='neutral'
                      copyable={false}
                      size='sm'
                    />
                  </td>
                  <td className='py-3'>
                    <StatusBadge
                      label={
                        model.quota_type === 0
                          ? 'Pay Per Token'
                          : 'Pay Per Request'
                      }
                      variant={model.quota_type === 0 ? 'info' : 'purple'}
                      copyable={false}
                      size='sm'
                    />
                  </td>
                  {model.quota_type === 0 ? (
                    <>
                      <td className='py-3 text-right'>
                        <span className='font-mono font-semibold text-orange-600 dark:text-orange-400'>
                          {formatGroupPrice(
                            model,
                            group,
                            'input',
                            currency,
                            tokenUnit,
                            showWithRecharge,
                            priceRate,
                            usdExchangeRate,
                            groupRatio
                          )}
                        </span>
                      </td>
                      <td className='py-3 text-right'>
                        <span className='font-mono font-semibold text-orange-600 dark:text-orange-400'>
                          {formatGroupPrice(
                            model,
                            group,
                            'output',
                            currency,
                            tokenUnit,
                            showWithRecharge,
                            priceRate,
                            usdExchangeRate,
                            groupRatio
                          )}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className='py-3 text-right'>
                      <span className='font-mono font-semibold text-orange-600 dark:text-orange-400'>
                        {formatFixedPrice(
                          model,
                          group,
                          currency,
                          showWithRecharge,
                          priceRate,
                          usdExchangeRate,
                          groupRatio
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
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
    autoGroups,
  } = usePricingData()

  const currency = ((search as any).currency as 'USD' | 'CNY') || 'USD'
  const tokenUnit = ((search as any).tokenUnit as 'M' | 'K') || 'M'
  const showWithRecharge = (search as any).showRecharge === 'true'

  const model = useMemo(() => {
    if (!models || !modelId) return null
    return models.find((m) => m.model_name === modelId) || null
  }, [models, modelId])

  const handleBack = () => {
    navigate({
      to: '/pricing',
      search: (prev) => prev,
    })
  }

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!model) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <h2 className='mb-2 text-xl font-semibold'>Model not found</h2>
          <p className='text-muted-foreground mb-4'>
            The model you're looking for doesn't exist.
          </p>
          <Button onClick={handleBack}>Back to Pricing</Button>
        </div>
      </div>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl space-y-6'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='sm' onClick={handleBack}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
        </div>

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
          autoGroups={autoGroups || []}
          currency={currency}
          tokenUnit={tokenUnit}
          showWithRecharge={showWithRecharge}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
        />
      </div>
    </PublicLayout>
  )
}
