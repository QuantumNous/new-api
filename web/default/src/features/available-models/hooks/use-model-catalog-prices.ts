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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import { buildCatalogPriceIndex } from '../lib/model-catalog-price'

/**
 * Pricing rows keyed by model name, for the catalog's price panels.
 *
 * Shares the `['pricing']` query cache with the pricing page, so opening both
 * costs one request. `/api/pricing` sits behind the pricing nav module: when a
 * deployment turns that module off the request 403s, and the catalog simply
 * renders without prices rather than surfacing an error the user cannot act on.
 */
export function useModelCatalogPrices(): ReadonlyMap<string, PricingModel> {
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return useMemo(
    () => buildCatalogPriceIndex(pricingQuery.data?.data),
    [pricingQuery.data]
  )
}
