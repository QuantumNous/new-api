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
import { useQueryClient } from '@tanstack/react-query'
import { DollarSign, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'

import { getCodexUsage, updateChannelBalance } from '../../api'
import { CHANNEL_TYPE_NEW_API } from '../../constants'
import { channelsQueryKeys, formatNewAPIBalance } from '../../lib'
import type { ChannelBalanceInfo } from '../../types'
import { useChannels } from '../channels-provider'
import {
  CodexUsageDialog,
  type CodexUsageDialogData,
} from './codex-usage-dialog'

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
  const [balanceInfo, setBalanceInfo] = useState<ChannelBalanceInfo | null>(
    null
  )
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState<number | null>(null)
  const [codexUsageResponse, setCodexUsageResponse] =
    useState<CodexUsageDialogData | null>(null)

  const isCodex = currentRow?.type === 57

  const handleQueryCodexUsage = async () => {
    const row = currentRow
    if (!row) return
    setIsQuerying(true)
    try {
      const res = await getCodexUsage(row.id)
      if (!res.success) {
        throw new Error(res.message || t('Failed to fetch usage'))
      }
      setCodexUsageResponse(res)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to fetch usage')
      )
    } finally {
      setIsQuerying(false)
    }
  }

  useEffect(() => {
    if (!isCodex) return
    if (!open) return
    handleQueryCodexUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isCodex])

  if (!currentRow) return null

  const handleQueryBalance = async () => {
    setIsQuerying(true)
    try {
      const response = await updateChannelBalance(currentRow.id)
      const hasBalance = response.balance !== undefined
      const hasStructuredData = response.data !== undefined
      const hasPayload = hasBalance || hasStructuredData

      if (hasPayload) {
        const now = Math.floor(Date.now() / 1000)
        if (hasBalance) {
          setBalance(response.balance ?? null)
        }
        if (response.data) {
          setBalanceInfo(response.data)
        }
        setBalanceUpdatedAt(now)

        setCurrentRow({
          ...currentRow,
          balance: response.balance ?? currentRow.balance,
          balance_info: response.data ?? currentRow.balance_info,
          balance_updated_time: hasBalance
            ? now
            : currentRow.balance_updated_time,
        })
        await queryClient.invalidateQueries({
          queryKey: channelsQueryKeys.lists(),
        })
      }

      if (response.success && hasPayload) {
        toast.success(t('Balance updated successfully'))
      } else {
        toast.error(response.message || t('Failed to query balance'))
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to query balance')
      )
    } finally {
      setIsQuerying(false)
    }
  }

  const handleClose = () => {
    setBalance(null)
    setBalanceInfo(null)
    setBalanceUpdatedAt(null)
    setCodexUsageResponse(null)
    onOpenChange(false)
  }

  if (isCodex) {
    return (
      <CodexUsageDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose()
        }}
        channelName={currentRow.name}
        channelId={currentRow.id}
        response={codexUsageResponse}
        onRefresh={handleQueryCodexUsage}
        isRefreshing={isQuerying}
      />
    )
  }

  const displayedInfo =
    currentRow.type === CHANNEL_TYPE_NEW_API
      ? (balanceInfo ?? currentRow.balance_info)
      : null
  const displayedBalance = balance ?? currentRow.balance
  const displayedAmount = displayedInfo
    ? formatNewAPIBalance(displayedInfo, t('Unlimited'))
    : formatCurrencyFromUSD(displayedBalance, {
        digitsLarge: 2,
        digitsSmall: 4,
        abbreviate: false,
      })
  const displayedUpdatedAt =
    displayedInfo?.updated_at ??
    balanceUpdatedAt ??
    currentRow.balance_updated_time

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t('Query Balance')}
      description={
        <>
          {t('Update balance for:')}
          <strong>{currentRow.name}</strong>
        </>
      }
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <Button variant='outline' onClick={handleClose} disabled={isQuerying}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-4 py-4'>
        <div className='bg-muted/50 rounded-lg border p-4'>
          <div className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
            <IconBadge tone='success' size='xs'>
              <DollarSign aria-hidden='true' />
            </IconBadge>
            <span>{t('Current Balance')}</span>
          </div>
          <div className='text-2xl font-bold break-all'>{displayedAmount}</div>
          <div className='text-muted-foreground mt-2 text-xs'>
            {t('Last updated:')}{' '}
            {displayedUpdatedAt > 0
              ? formatTimestampToDate(displayedUpdatedAt)
              : t('Never')}
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
    </Dialog>
  )
}
