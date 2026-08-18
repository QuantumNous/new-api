/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CircleCheck, Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { claimRedemptionCode, redeemCode } from './api'

interface RedeemCreditsProps {
  purpose?: string
}

export function RedeemCredits(props: RedeemCreditsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const purpose = props.purpose?.trim() || ''
  const claimQuery = useQuery({
    queryKey: ['redemption-code-claim', purpose],
    queryFn: () => claimRedemptionCode(purpose),
    enabled: purpose.length > 0,
    retry: false,
  })
  const redeemMutation = useMutation({
    mutationFn: redeemCode,
    onSuccess: (result) => {
      if (!result.success) return
      toast.success(t('Credits added to your wallet'))
      navigate({ to: '/wallet' })
    },
  })

  useEffect(() => {
    if (claimQuery.data?.success && claimQuery.data.data?.key) {
      setCode(claimQuery.data.data.key)
    }
  }, [claimQuery.data])

  const claimUnavailable =
    purpose.length > 0 &&
    claimQuery.data &&
    !claimQuery.data.success &&
    (claimQuery.data.code === 'redemption_codes_exhausted' ||
      claimQuery.data.code === 'redemption_already_claimed')

  const claimFailed =
    purpose.length > 0 &&
    (claimQuery.isError ||
      (claimQuery.data && !claimQuery.data.success && !claimUnavailable))

  if (claimUnavailable) {
    const alreadyClaimed =
      claimQuery.data?.code === 'redemption_already_claimed'
    return (
      <main className='flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8'>
        <Card className='border-border/70 w-full max-w-md shadow-sm'>
          <CardContent className='flex flex-col items-center px-6 py-10 text-center sm:px-10'>
            <div className='bg-muted mb-5 flex size-12 items-center justify-center rounded-full'>
              <Gift
                aria-hidden='true'
                className='text-muted-foreground size-6'
              />
            </div>
            <h1 className='text-xl font-semibold tracking-tight'>
              {alreadyClaimed
                ? t('You already claimed this offer')
                : t('All codes have been claimed')}
            </h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              {claimQuery.data?.message ||
                t('Too late — all codes have already been claimed')}
            </p>
            <Button
              className='mt-6 w-full'
              onClick={() => navigate({ to: '/wallet' })}
            >
              {t('Go to wallet')}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (claimFailed) {
    return (
      <main className='flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8'>
        <Card className='border-border/70 w-full max-w-md shadow-sm'>
          <CardContent className='flex flex-col items-center px-6 py-10 text-center sm:px-10'>
            <div className='bg-muted mb-5 flex size-12 items-center justify-center rounded-full'>
              <Gift
                aria-hidden='true'
                className='text-muted-foreground size-6'
              />
            </div>
            <h1 className='text-xl font-semibold tracking-tight'>
              {t('Unable to claim redemption code')}
            </h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              {claimQuery.data?.message || t('Please try again in a moment.')}
            </p>
            <Button
              className='mt-6 w-full'
              disabled={claimQuery.isFetching}
              onClick={() => claimQuery.refetch()}
            >
              {claimQuery.isFetching ? (
                <Loader2
                  aria-hidden='true'
                  className='mr-2 size-4 animate-spin'
                />
              ) : null}
              {t('Try again')}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedCode = code.trim()
    if (!trimmedCode) {
      toast.error(t('Please enter a redemption code'))
      return
    }
    redeemMutation.mutate(trimmedCode)
  }

  return (
    <main className='flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8'>
      <Card className='border-border/70 w-full max-w-md shadow-sm'>
        <CardHeader className='space-y-3 px-6 pt-8 text-center sm:px-10'>
          <div className='bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full'>
            <CircleCheck aria-hidden='true' className='text-primary size-6' />
          </div>
          <div>
            <CardTitle className='text-2xl'>{t('Redeem credits')}</CardTitle>
            <p className='text-muted-foreground mt-2 text-sm'>
              {t('Enter your code to add credits to your wallet.')}
            </p>
          </div>
        </CardHeader>
        <CardContent className='px-6 pb-8 sm:px-10'>
          <form className='space-y-5' onSubmit={submit}>
            {purpose ? (
              <div className='bg-muted/70 rounded-lg px-3 py-2 text-center text-sm'>
                <span className='text-muted-foreground'>{t('Offer')}:</span>{' '}
                <span className='font-medium'>{purpose}</span>
              </div>
            ) : null}
            <div className='space-y-2'>
              <Label htmlFor='redemption-code'>{t('Redemption Code')}</Label>
              <div className='relative'>
                <Input
                  id='redemption-code'
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t('Enter your redemption code')}
                  autoComplete='off'
                  autoCapitalize='none'
                  spellCheck={false}
                  disabled={claimQuery.isLoading || redeemMutation.isPending}
                  className='h-11 font-mono'
                />
                {claimQuery.isLoading ? (
                  <Loader2
                    aria-label={t('Loading redemption code')}
                    className='text-muted-foreground absolute top-3 right-3 size-5 animate-spin'
                  />
                ) : null}
              </div>
            </div>
            <Button
              type='submit'
              className='h-11 w-full'
              disabled={
                claimQuery.isLoading ||
                redeemMutation.isPending ||
                code.trim().length === 0
              }
            >
              {redeemMutation.isPending ? (
                <Loader2
                  aria-hidden='true'
                  className='mr-2 size-4 animate-spin'
                />
              ) : null}
              {t('Redeem credits')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
