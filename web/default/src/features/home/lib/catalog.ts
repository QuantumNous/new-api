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
import type {
  PricingData,
  PricingModel,
  PricingVendor,
} from '@/features/pricing/types'

export type HomeCatalogModel = PricingModel & {
  vendor_name?: string
  vendor_icon?: string
  vendor_description?: string
}

export function getHomeCatalogModels(
  data: PricingData | undefined
): HomeCatalogModel[] {
  if (!data?.data?.length) return []

  const vendorMap = new Map(
    (data.vendors ?? []).map((vendor) => [vendor.id, vendor])
  )

  return data.data.map((model) => {
    const vendor =
      model.vendor_id == null ? undefined : vendorMap.get(model.vendor_id)

    return {
      ...model,
      vendor_name: vendor?.name,
      vendor_icon: vendor?.icon,
      vendor_description: vendor?.description,
      group_ratio: data.group_ratio,
    }
  })
}

export function fillProviderMarquee(
  vendors: PricingVendor[],
  minimumItems = 12
): PricingVendor[] {
  if (vendors.length === 0) return []

  const count = Math.max(minimumItems, vendors.length)
  return Array.from({ length: count }, (_, index) => {
    return vendors[index % vendors.length]
  })
}
