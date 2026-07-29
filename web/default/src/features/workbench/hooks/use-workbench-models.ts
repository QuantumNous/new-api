/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMemo } from 'react'

import { getModelModality } from '@/features/playground/lib/studio/model-modality'
import type { StudioModality } from '@/features/playground/types'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { compareVendorNames } from '@/features/pricing/lib/model-helpers'
import { canTryInPlayground } from '@/features/pricing/lib/playground-eligibility'

export type WorkbenchModelOption = {
  value: string
  label: string
  modality: StudioModality
  vendorName?: string
}

export function useWorkbenchModels() {
  const pricing = usePricingData('playground')

  return useMemo(() => {
    const options = pricing.models
      .filter(canTryInPlayground)
      .map((model) => ({
        value: model.model_name,
        label: model.model_name,
        modality: getModelModality(model),
        vendorName: model.vendor_name?.trim() || undefined,
      }))
      .sort((left, right) => {
        const byVendor = compareVendorNames(left.vendorName, right.vendorName)
        if (byVendor !== 0) return byVendor
        return left.label.localeCompare(right.label)
      })

    return {
      isLoading: pricing.isLoading,
      options,
      byModality: (modality: StudioModality) =>
        options.filter((option) => option.modality === modality),
    }
  }, [pricing.isLoading, pricing.models])
}
