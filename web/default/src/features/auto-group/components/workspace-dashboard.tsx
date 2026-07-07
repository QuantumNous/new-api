import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Shield, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  applyHighConfidenceSuggestions,
  getAutoGroupDashboard,
  replayAutoGroupSuggestions,
} from '../api'
import { QUERY_KEYS } from '../constants'

export function WorkspaceDashboard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: QUERY_KEYS.DASHBOARD,
    queryFn: getAutoGroupDashboard,
  })
  const dashboard = data?.data

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUGGESTIONS }),
    ])
  }

  const replayMutation = useMutation({
    mutationFn: replayAutoGroupSuggestions,
    onSuccess: async (result) => {
      if (result.success) {
        toast.success(t('Replay completed'))
        await invalidate()
      }
    },
  })

  const applyMutation = useMutation({
    mutationFn: applyHighConfidenceSuggestions,
    onSuccess: async (result) => {
      if (result.success) {
        toast.success(t('Applied {{count}} high-confidence suggestions', { count: result.data?.applied ?? 0 }))
        await invalidate()
      }
    },
  })

  const cards = [
    { label: t('Total users'), value: dashboard?.total_users ?? 0, icon: Users },
    { label: t('Auto apply'), value: dashboard?.auto_apply_count ?? 0, icon: CheckCircle2 },
    { label: t('Need confirmation'), value: dashboard?.confirm_required_count ?? 0, icon: Clock },
    { label: t('Protected'), value: dashboard?.protected_count ?? 0, icon: Shield },
  ]

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 md:grid-cols-4'>
        {cards.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} size='sm'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>{item.label}</CardTitle>
                <Icon className='size-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-semibold'>{item.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Card size='sm'>
        <CardContent className='flex flex-wrap items-center justify-between gap-3 pt-4'>
          <div className='space-y-1'>
            <div className='font-medium'>{t('Suggestion workflow')}</div>
            <div className='text-sm text-muted-foreground'>
              {t('Replay current users first, then apply only high-confidence suggestions.')}
            </div>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => replayMutation.mutate()} disabled={replayMutation.isPending}>
              {replayMutation.isPending ? t('Replaying...') : t('Replay current users')}
            </Button>
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? t('Applying...') : t('Apply high-confidence')}
            </Button>
            <Badge variant='outline'>{t('Based on Feishu user groups')}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
