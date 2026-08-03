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

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { getTeamBilling } from '../api'
import { ERROR_MESSAGES } from '../constants'

export function TeamBillingTab({ teamId }: { teamId: number }) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['team-billing', teamId],
    queryFn: async () => {
      const result = await getTeamBilling(teamId)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_BILLING_FAILED))
        return null
      }
      return result.data ?? null
    },
  })

  const summaryCards = [
    { title: t('Member Count'), value: data?.member_count ?? 0 },
    { title: t('Allocated Quota'), value: data?.allocated ?? 0 },
    { title: t('Used Quota'), value: data?.used ?? 0 },
  ]

  const usageCards = [
    { title: t('Actual Usage Quota'), value: data?.usage_quota ?? 0 },
    { title: t('Prompt Tokens'), value: data?.prompt_tokens ?? 0 },
    { title: t('Completion Tokens'), value: data?.completion_tokens ?? 0 },
    { title: t('Request Count'), value: data?.request_count ?? 0 },
  ]

  const renderCards = (cards: { title: string; value: number }[]) =>
    cards.map((card) => (
      <Card key={card.title}>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
        </CardHeader>
        <CardContent className='text-2xl font-semibold tabular-nums'>
          {isLoading ? '…' : card.value}
        </CardContent>
      </Card>
    ))

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>{renderCards(summaryCards)}</div>
      <div>
        <CardDescription className='mb-2'>
          {t('Real usage aggregated from consume logs (by team_id)')}
        </CardDescription>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {renderCards(usageCards)}
        </div>
      </div>
    </div>
  )
}
