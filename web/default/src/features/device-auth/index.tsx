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
import { useMutation, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { CheckCircle2, Laptop, ShieldAlert, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { approveDeviceAuth, getDeviceAuthInfo } from './api'
import { DeviceAuthOutcome } from './components/device-auth-outcome'
import { DeviceAuthRequestCard } from './components/device-auth-request-card'

const routeApi = getRouteApi('/_authenticated/device')

export function DeviceAuthorizePage() {
  const { t } = useTranslation()
  const search = routeApi.useSearch()
  const [userCode, setUserCode] = useState(search.code ?? '')
  const [submittedCode, setSubmittedCode] = useState(search.code ?? '')
  const [outcome, setOutcome] = useState<'approved' | 'denied' | null>(null)

  const infoQuery = useQuery({
    queryKey: ['device-auth-info', submittedCode],
    queryFn: () => getDeviceAuthInfo(submittedCode),
    enabled: submittedCode.length > 0 && outcome === null,
    retry: false,
    staleTime: 0,
  })

  const decision = useMutation({
    mutationFn: (approve: boolean) => approveDeviceAuth(submittedCode, approve),
    onSuccess: (res, approve) => {
      if (res.success) {
        setOutcome(approve ? 'approved' : 'denied')
      }
    },
  })

  if (outcome !== null) {
    return (
      <DeviceAuthShell>
        <DeviceAuthOutcome outcome={outcome} />
      </DeviceAuthShell>
    )
  }

  if (submittedCode.length === 0) {
    return (
      <DeviceAuthShell>
        <form
          className='flex flex-col gap-4 rounded-xl border p-5'
          onSubmit={(event) => {
            event.preventDefault()
            setSubmittedCode(userCode.trim())
          }}
        >
          <div className='flex items-center gap-2'>
            <Laptop className='size-4' aria-hidden='true' />
            <h3 className='text-sm font-semibold'>
              {t('Enter the code shown in the desktop app')}
            </h3>
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='device-user-code'>{t('Sign-in code')}</Label>
            <Input
              id='device-user-code'
              autoFocus
              autoComplete='off'
              placeholder='XXXX-XXXX'
              value={userCode}
              onChange={(event) => setUserCode(event.target.value)}
            />
          </div>
          <Button type='submit' disabled={userCode.trim().length === 0}>
            {t('Continue')}
          </Button>
        </form>
      </DeviceAuthShell>
    )
  }

  if (infoQuery.isLoading) {
    return (
      <DeviceAuthShell>
        <div className='flex flex-col gap-3 rounded-xl border p-5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-4 w-64' />
          <Skeleton className='h-9 w-full' />
        </div>
      </DeviceAuthShell>
    )
  }

  const info = infoQuery.data?.success ? infoQuery.data.data : undefined
  if (!info) {
    const message =
      infoQuery.data?.message ?? t('This sign-in code could not be verified')
    return (
      <DeviceAuthShell>
        <div className='flex flex-col items-start gap-4 rounded-xl border p-5'>
          <div className='flex items-center gap-2'>
            <ShieldAlert
              className='text-destructive size-4'
              aria-hidden='true'
            />
            <h3 className='text-sm font-semibold'>{message}</h3>
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setUserCode('')
              setSubmittedCode('')
            }}
          >
            {t('Try another code')}
          </Button>
        </div>
      </DeviceAuthShell>
    )
  }

  return (
    <DeviceAuthShell>
      <DeviceAuthRequestCard info={info} />
      <div className='flex flex-col gap-2 sm:flex-row'>
        <Button
          type='button'
          className='gap-1.5'
          disabled={decision.isPending}
          onClick={() => decision.mutate(true)}
        >
          <CheckCircle2 className='size-4' aria-hidden='true' />
          {t('Authorize this device')}
        </Button>
        <Button
          type='button'
          variant='outline'
          className='gap-1.5'
          disabled={decision.isPending}
          onClick={() => decision.mutate(false)}
        >
          <XCircle className='size-4' aria-hidden='true' />
          {t('Deny')}
        </Button>
      </div>
    </DeviceAuthShell>
  )
}

function DeviceAuthShell(props: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Desktop sign-in')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-xl flex-col gap-5'>
          {props.children}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
