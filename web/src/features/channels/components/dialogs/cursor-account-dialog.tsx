/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import type { CodexUsageDialogData } from './codex-usage-dialog'

type CursorAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  response: CodexUsageDialogData | null
  onRefresh: () => void | Promise<void>
  isRefreshing?: boolean
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value)
}

function money(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '-'
}

export function CursorAccountDialog({
  open,
  onOpenChange,
  channelName,
  response,
  onRefresh,
  isRefreshing,
}: CursorAccountDialogProps) {
  const { t } = useTranslation()
  const data = record(response?.data)
  const account = record(data.account)
  const quota = record(data.quota)
  const catalog = record(data.catalog)
  const usedPercent = Math.max(
    0,
    Math.min(100, Number(quota.used_percent) || 0)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Cursor Account Info')}
      description={channelName}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <Button onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
          {t('Refresh')}
        </Button>
      }
    >
      <div className='grid gap-3 md:grid-cols-2'>
        <Card size='sm'>
          <CardHeader>
            <CardTitle>{t('Account Info')}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-1 text-sm'>
            <p>
              {t('Email')}: {text(account.email)}
            </p>
            <p>
              {t('Account Type')}: {text(account.account_kind)}
            </p>
            <p>
              {t('API Key Name')}: {text(account.api_key_name)}
            </p>
            <p>
              {t('Available Models')}: {text(catalog.model_count)}
            </p>
          </CardContent>
        </Card>
        <Card size='sm'>
          <CardHeader>
            <CardTitle>{t('Quota Usage')}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            {quota.available === true ? (
              <>
                <p>
                  {t('Plan')}: {text(quota.plan_name)}
                </p>
                <Progress value={usedPercent} />
                <p>
                  {money(quota.used_usd)} / {money(quota.limit_usd)} (
                  {usedPercent.toFixed(1)}%)
                </p>
                <p>
                  {t('Remaining')}: {money(quota.remaining_usd)}
                </p>
                <p>
                  {t('Billing Cycle End')}: {text(quota.billing_cycle_end)}
                </p>
              </>
            ) : (
              <p>
                {t('Quota details are unavailable')}: {text(quota.reason)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Dialog>
  )
}
