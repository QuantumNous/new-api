import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RotateCcw } from 'lucide-react'
import { getUserModelQuotaUsage, resetUserModelQuotaUsage } from './api'
import { formatQuota } from '@/lib/format'
import type { UserModelQuotaUsage } from './types'

export function UserModelQuotaDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['user-model-quota-usage', userId],
    queryFn: () => getUserModelQuotaUsage(userId!),
    enabled: !!userId && open,
  })

  const resetMutation = useMutation({
    mutationFn: resetUserModelQuotaUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-model-quota-usage', userId] })
      toast.success(t('Quota reset successfully'))
    },
    onError: () => toast.error(t('Failed to reset quota')),
  })

  const usages: UserModelQuotaUsage[] = data?.data?.items ?? []

  function getProgressColor(percent: number) {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Model Quota Usage')}</DialogTitle>
          <DialogDescription>
            {t('Per-model quota consumption for this user.')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : usages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {t('No model quota limits applied to this user.')}
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {usages.map((usage) => {
              const percent = usage.usage_percent ?? 0
              const remain = usage.quota_remain ?? (usage.quota_limit - usage.quota_used)
              return (
                <div key={usage.id} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{usage.model_pattern}</span>
                      <Badge variant="secondary">{usage.rule_source}</Badge>
                      {usage.status === 'expired' && (
                        <Badge variant="outline">{t('Expired')}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetMutation.mutate(usage.id)}
                      disabled={resetMutation.isPending}
                    >
                      <RotateCcw className="size-3 mr-1" />
                      {t('Reset')}
                    </Button>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 w-full rounded-full bg-muted">
                    <div
                      className={`absolute left-0 top-0 h-2 rounded-full transition-all ${getProgressColor(percent)}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {t('Used')}: {formatQuota(usage.quota_used)} / {formatQuota(usage.quota_limit)}
                    </span>
                    <span>
                      {t('Remaining')}: {formatQuota(remain)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {percent.toFixed(1)}% {t('used')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
