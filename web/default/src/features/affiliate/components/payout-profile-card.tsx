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
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getSelfAffiliatePayoutProfile,
  updateSelfAffiliatePayoutProfile,
} from '@/features/affiliate-commissions/api'

export function PayoutProfileCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [account, setAccount] = useState('')
  const [accountName, setAccountName] = useState('')

  const payoutQuery = useQuery({
    queryKey: ['self-affiliate-payout-profile'],
    queryFn: getSelfAffiliatePayoutProfile,
  })

  const profile = payoutQuery.data?.data
  const hasAccount = Boolean(profile?.account)

  useEffect(() => {
    setAccount(profile?.account || '')
    setAccountName(profile?.account_name || '')
  }, [profile?.account, profile?.account_name])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSelfAffiliatePayoutProfile({
        method: 'paypal',
        account,
        account_name: accountName,
      }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to save PayPal payout account'))
        return
      }
      toast.success(t('PayPal payout account saved'))
      queryClient.invalidateQueries({
        queryKey: ['self-affiliate-payout-profile'],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to save PayPal payout account'))
    },
  })

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='space-y-4 p-3 sm:p-4'>
        <div className='flex min-w-0 items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
              <CreditCard className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-semibold'>
                {t('PayPal Payout Account')}
              </h3>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {t(
                  'Top-up commissions are paid offline to this PayPal account.'
                )}
              </p>
            </div>
          </div>
          <Badge variant={hasAccount ? 'secondary' : 'outline'}>
            {hasAccount ? t('Configured') : t('Not configured')}
          </Badge>
        </div>

        {!hasAccount && !payoutQuery.isLoading ? (
          <Alert>
            <AlertDescription>
              {t(
                'Pending top-up commissions can be generated before this is filled, but admins cannot settle them until a PayPal account is provided.'
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {payoutQuery.isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2'>
            <Skeleton className='h-16 rounded-lg' />
            <Skeleton className='h-16 rounded-lg' />
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto] sm:items-end'>
            <div className='space-y-2'>
              <Label htmlFor='affiliate-paypal-account'>
                {t('PayPal Email')}
              </Label>
              <Input
                id='affiliate-paypal-account'
                type='email'
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder='agent@example.com'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='affiliate-paypal-account-name'>
                {t('Account holder name')}
              </Label>
              <Input
                id='affiliate-paypal-account-name'
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder={t('Optional')}
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className='sm:min-w-24'
            >
              {saveMutation.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : null}
              {t('Save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
