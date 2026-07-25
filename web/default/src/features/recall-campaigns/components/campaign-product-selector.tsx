import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import {
  getRecallSubscriptionProductConfiguration,
  getRecallTopUpProductConfiguration,
  recallCampaignKeys,
} from '../api'
import {
  buildSubscriptionProductOptions,
  buildTopUpProductOptions,
  getRecallProductSelectorState,
  isRecallProductSelectorDisabled,
  selectedRecallProductFallbackOptions,
} from '../product-options'

interface CampaignProductSelectorProps {
  topUpPriceIDs: string[]
  subscriptionPriceIDs: string[]
  onTopUpChange: (value: string[]) => void
  onSubscriptionChange: (value: string[]) => void
  immutable: boolean
}

interface ProductSelectorMessageProps {
  state: ReturnType<typeof getRecallProductSelectorState>
  loading: string
  error: string
  empty: string
}

function ProductSelectorMessage(props: ProductSelectorMessageProps) {
  if (props.state === 'loading') {
    return <p className='text-muted-foreground text-xs'>{props.loading}</p>
  }
  if (props.state === 'error') {
    return <p className='text-destructive text-xs'>{props.error}</p>
  }
  if (props.state === 'empty') {
    return <p className='text-muted-foreground text-xs'>{props.empty}</p>
  }
  return null
}

export function CampaignProductSelector(props: CampaignProductSelectorProps) {
  const { t } = useTranslation()
  const topUpQuery = useQuery({
    queryKey: recallCampaignKeys.topUpProductConfiguration,
    queryFn: getRecallTopUpProductConfiguration,
  })
  const subscriptionQuery = useQuery({
    queryKey: recallCampaignKeys.subscriptionProductConfiguration,
    queryFn: getRecallSubscriptionProductConfiguration,
  })

  const unavailableLabel = t('Unavailable')
  const configuredTopUpOptions = topUpQuery.isSuccess
    ? buildTopUpProductOptions(
        topUpQuery.data.data?.stripe_price_ids ?? {},
        props.topUpPriceIDs,
        unavailableLabel
      )
    : []
  const configuredSubscriptionOptions = subscriptionQuery.isSuccess
    ? buildSubscriptionProductOptions(
        subscriptionQuery.data.data ?? [],
        props.subscriptionPriceIDs,
        unavailableLabel
      )
    : []
  const topUpOptions = topUpQuery.isSuccess
    ? configuredTopUpOptions
    : selectedRecallProductFallbackOptions(props.topUpPriceIDs)
  const subscriptionOptions = subscriptionQuery.isSuccess
    ? configuredSubscriptionOptions
    : selectedRecallProductFallbackOptions(props.subscriptionPriceIDs)
  const topUpState = getRecallProductSelectorState(
    topUpQuery.isLoading,
    topUpQuery.isError,
    configuredTopUpOptions.some((option) => !option.unavailable)
  )
  const subscriptionState = getRecallProductSelectorState(
    subscriptionQuery.isLoading,
    subscriptionQuery.isError,
    configuredSubscriptionOptions.some((option) => !option.unavailable)
  )

  return (
    <>
      <div className='space-y-2'>
        <Label htmlFor='recall-top-up-products'>{t('Top-up products')}</Label>
        <MultiSelect
          id='recall-top-up-products'
          options={topUpOptions}
          selected={props.topUpPriceIDs}
          onChange={props.onTopUpChange}
          placeholder={t('Select top-up products')}
          emptyText={t('No configured Stripe top-up products')}
          disabled={isRecallProductSelectorDisabled(
            props.immutable,
            topUpState
          )}
        />
        <ProductSelectorMessage
          state={topUpState}
          loading={t('Loading configured products...')}
          error={t('Failed to load configured top-up products.')}
          empty={t('Configure Stripe top-up prices in Payment settings.')}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='recall-subscription-products'>
          {t('Subscription products')}
        </Label>
        <MultiSelect
          id='recall-subscription-products'
          options={subscriptionOptions}
          selected={props.subscriptionPriceIDs}
          onChange={props.onSubscriptionChange}
          placeholder={t('Select subscription products')}
          emptyText={t('No configured Stripe subscription products')}
          disabled={isRecallProductSelectorDisabled(
            props.immutable,
            subscriptionState
          )}
        />
        <ProductSelectorMessage
          state={subscriptionState}
          loading={t('Loading configured products...')}
          error={t('Failed to load configured subscription products.')}
          empty={t(
            'Configure enabled Stripe subscription plans in Subscription management.'
          )}
        />
      </div>
    </>
  )
}
