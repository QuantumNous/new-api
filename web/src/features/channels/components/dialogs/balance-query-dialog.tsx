import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateChannelBalance } from '../../api'
import { channelsQueryKeys } from '../../lib'
import { useChannels } from '../channels-provider'

type BalanceQueryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BalanceQueryDialog({
  open,
  onOpenChange,
}: BalanceQueryDialogProps) {
  const { t } = useTranslation()
  const { currentRow, setCurrentRow } = useChannels()
  const queryClient = useQueryClient()
  const [isQuerying, setIsQuerying] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceUpdatedTime, setBalanceUpdatedTime] = useState<number | null>(
    null
  )

  if (!currentRow) return null

  const handleQueryBalance = async () => {
    setIsQuerying(true)
    try {
      const response = await updateChannelBalance(currentRow.id)
      if (response.success && response.balance !== undefined) {
        const newBalance = response.balance
        const now = Math.floor(Date.now() / 1000)

        setBalance(newBalance)
        setBalanceUpdatedTime(now)
        toast.success(t('Balance updated successfully'))

        // Update currentRow immediately with new balance and timestamp
        setCurrentRow({
          ...currentRow,
          balance: newBalance,
          balance_updated_time: now,
        })

        // Invalidate queries to refresh the table
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      } else {
        toast.error(response.message || t('Failed to query balance'))
      }
    } catch (error: any) {
      toast.error(error?.message || t('Failed to query balance'))
    } finally {
      setIsQuerying(false)
    }
  }

  const handleClose = () => {
    setBalance(null)
    setBalanceUpdatedTime(null)
    onOpenChange(false)
  }

  const formatBalance = (bal: number) =>
    formatCurrencyFromUSD(bal, {
      digitsLarge: 2,
      digitsSmall: 4,
      abbreviate: false,
    })

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never'
    return formatTimestampToDate(timestamp)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Query Balance')}</DialogTitle>
          <DialogDescription>
            {t('Update balance for:')} <strong>{currentRow.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Current Balance Display */}
          <div className='bg-muted/50 rounded-lg border p-4'>
            <div className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
              <DollarSign className='h-4 w-4' />
              <span>{t('Current Balance')}</span>
            </div>
            <div className='text-2xl font-bold'>
              {balance !== null
                ? formatBalance(balance)
                : formatBalance(currentRow.balance)}
            </div>
            <div className='text-muted-foreground mt-2 text-xs'>
              {t('Last updated:')}{' '}
              {formatDate(
                balanceUpdatedTime ?? currentRow.balance_updated_time
              )}
            </div>
          </div>

          {/* Balance Update Button */}
          <Button
            className='w-full'
            onClick={handleQueryBalance}
            disabled={isQuerying}
          >
            {isQuerying && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {!isQuerying && <RefreshCw className='mr-2 h-4 w-4' />}
            {isQuerying ? t('Querying...') : t('Update Balance')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose} disabled={isQuerying}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
