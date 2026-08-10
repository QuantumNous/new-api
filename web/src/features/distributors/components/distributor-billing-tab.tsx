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
*/
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getDistributorBilling } from '../api'
import { ERROR_MESSAGES } from '../constants'

export function DistributorBillingTab({
  distributorId,
}: {
  distributorId: number
}) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['distributor-billing', distributorId],
    queryFn: async () => {
      const result = await getDistributorBilling(distributorId)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_BILLING_FAILED))
        return null
      }
      return result.data ?? null
    },
  })

  const cards = [
    { title: t('Sub-User Count'), value: data?.sub_user_count ?? 0 },
    { title: t('Allocated Quota'), value: data?.allocated ?? 0 },
    { title: t('Used Quota'), value: data?.used ?? 0 },
  ]

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold tabular-nums'>
            {isLoading ? '…' : card.value}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
