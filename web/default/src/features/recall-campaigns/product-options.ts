import type { RecallSubscriptionProductRecord } from './types'

export interface RecallProductOption {
  value: string
  label: string
  unavailable: boolean
}

export type RecallProductSelectorState = 'loading' | 'error' | 'empty' | 'ready'

export function getRecallProductSelectorState(
  isLoading: boolean,
  isError: boolean,
  hasConfiguredOptions: boolean
): RecallProductSelectorState {
  if (isLoading) return 'loading'
  if (isError) return 'error'
  return hasConfiguredOptions ? 'ready' : 'empty'
}

export function isRecallProductSelectorDisabled(
  immutable: boolean,
  state: RecallProductSelectorState
): boolean {
  return immutable || state === 'loading'
}

export function selectedRecallProductFallbackOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }))
}

export function appendUnavailableSelections(
  options: RecallProductOption[],
  selected: string[],
  unavailableLabel = 'Unavailable'
): RecallProductOption[] {
  const known = new Set(options.map((option) => option.value))
  const result = [...options]
  for (const rawValue of selected) {
    const value = rawValue.trim()
    if (value === '' || known.has(value)) continue
    known.add(value)
    result.push({
      value,
      label: `${unavailableLabel} · ${value}`,
      unavailable: true,
    })
  }
  return result
}

export function buildTopUpProductOptions(
  priceIDs: Record<string, string>,
  selected: string[],
  unavailableLabel = 'Unavailable'
): RecallProductOption[] {
  const options = Object.entries(priceIDs)
    .map(([amount, rawPriceID]) => ({
      amount: Number(amount),
      priceID: rawPriceID.trim(),
    }))
    .filter(({ amount, priceID }) => Number.isFinite(amount) && priceID !== '')
    .sort((left, right) => left.amount - right.amount)
    .map(({ amount, priceID }) => ({
      value: priceID,
      label: `${amount} USD`,
      unavailable: false,
    }))

  return appendUnavailableSelections(options, selected, unavailableLabel)
}

export function buildSubscriptionProductOptions(
  records: RecallSubscriptionProductRecord[],
  selected: string[],
  unavailableLabel = 'Unavailable'
): RecallProductOption[] {
  const options = records
    .filter(({ plan }) => plan.enabled && Boolean(plan.stripe_price_id?.trim()))
    .map(({ plan }) => {
      const priceID = plan.stripe_price_id!.trim()
      return {
        value: priceID,
        label: `${plan.title} · ${plan.price_amount} ${plan.currency.toUpperCase()}`,
        unavailable: false,
      }
    })

  return appendUnavailableSelections(options, selected, unavailableLabel)
}
