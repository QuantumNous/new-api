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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'

import { formatCreemPrice } from '../lib/format'
import type { CreemProduct } from '../types'

interface CreemProductsSectionProps {
  products: CreemProduct[]
  onProductSelect: (product: CreemProduct) => void
  loading?: boolean
}

export function CreemProductsSection({
  products,
  onProductSelect,
  loading,
}: CreemProductsSectionProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
        <Skeleton className='h-16 rounded-lg' />
        <Skeleton className='h-16 rounded-lg' />
        <Skeleton className='h-16 rounded-lg' />
      </div>
    )
  }

  if (!Array.isArray(products) || products.length === 0) {
    return null
  }

  return (
    <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
      {products.map((product) => (
        <Button
          key={product.productId}
          variant='outline'
          className='h-auto min-h-16 flex-col items-start justify-center gap-1 rounded-lg px-3 py-2.5 text-left whitespace-normal sm:h-auto'
          onClick={() => onProductSelect(product)}
        >
          <span className='flex w-full items-center justify-between gap-2'>
            <span className='truncate text-base font-semibold'>
              {product.name}
            </span>
            <span className='shrink-0 text-sm font-medium tabular-nums'>
              {formatCreemPrice(product.price, product.currency)}
            </span>
          </span>
          <span className='text-muted-foreground w-full truncate text-xs font-normal'>
            {t('Quota')}: {formatNumber(product.quota)}
          </span>
        </Button>
      ))}
    </div>
  )
}
