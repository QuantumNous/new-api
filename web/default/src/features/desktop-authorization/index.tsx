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
import { AlertCircle, Check, Clock, Laptop, ShieldCheck, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserDisplay } from '@/hooks/use-user-display'
import { formatDateTimeObject } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import {
  decideDesktopAuthorization,
  getDesktopAuthorizationRequest,
} from './api'

const routeApi = getRouteApi('/_authenticated/desktop/authorize')

export function DesktopAuthorizationPage() {
  const { t } = useTranslation()
  const requestId = routeApi.useSearch().request
  const user = useAuthStore((state) => state.auth.user)
  const userDisplay = useUserDisplay(user)
  const requestQuery = useQuery({
    queryKey: ['desktop-authorization-request', requestId],
    queryFn: () => getDesktopAuthorizationRequest(requestId ?? ''),
    enabled: Boolean(requestId),
    retry: false,
  })
  const decision = useMutation({
    mutationFn: (approve: boolean) =>
      decideDesktopAuthorization(requestId ?? '', approve),
    onSuccess: (result) => window.location.replace(result.redirect_uri),
  })

  const request = requestQuery.data
  const expiresAt = request ? new Date(request.expires_at * 1000) : null
  const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false
  const pending = request?.status.toLowerCase() === 'pending'

  let stateMessage: string | null = null
  if (!requestId) stateMessage = t('The authorization request is missing')
  else if (requestQuery.isError) {
    stateMessage = t('The authorization request could not be loaded')
  } else if (expired || request?.status.toLowerCase() === 'expired') {
    stateMessage = t('This authorization request has expired')
  } else if (request && !pending) {
    stateMessage = t('This authorization request has already been decided')
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('BoxAI Desktop authorization')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <main
          className='mx-auto flex w-full max-w-xl flex-col gap-5'
          aria-live='polite'
        >
          {requestQuery.isLoading && (
            <Card aria-label={t('Loading authorization request')}>
              <CardHeader>
                <Skeleton className='h-6 w-48' />
                <Skeleton className='h-4 w-72' />
              </CardHeader>
              <CardContent className='space-y-3'>
                <Skeleton className='h-16 w-full' />
                <Skeleton className='h-24 w-full' />
              </CardContent>
            </Card>
          )}
          {!requestQuery.isLoading && stateMessage && (
            <Alert variant='destructive'>
              <AlertCircle aria-hidden='true' />
              <AlertTitle>{t('Unable to authorize BoxAI Desktop')}</AlertTitle>
              <AlertDescription>{stateMessage}</AlertDescription>
            </Alert>
          )}
          {!requestQuery.isLoading && !stateMessage && request && (
            <Card>
              <CardHeader>
                <div className='bg-primary/10 text-primary mb-2 flex size-11 items-center justify-center rounded-xl'>
                  <Laptop className='size-5' aria-hidden='true' />
                </div>
                <CardTitle>
                  {t('BoxAI Desktop wants to access your account')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'Only approve if you started this request in the desktop app.'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                <dl className='grid gap-3 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>
                      {t('Device name')}
                    </dt>
                    <dd className='font-medium'>{request.client_name}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>{t('Expires at')}</dt>
                    <dd className='flex items-center gap-1.5 font-medium'>
                      <Clock className='size-4' aria-hidden='true' />
                      {expiresAt ? formatDateTimeObject(expiresAt) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>
                      {t('Current account')}
                    </dt>
                    <dd className='font-medium'>
                      {userDisplay.displayName}
                      {userDisplay.secondaryText
                        ? ` · ${userDisplay.secondaryText}`
                        : ''}
                    </dd>
                  </div>
                </dl>
                <section aria-labelledby='desktop-permissions-title'>
                  <h2
                    id='desktop-permissions-title'
                    className='mb-2 flex items-center gap-2 text-sm font-semibold'
                  >
                    <ShieldCheck className='size-4' aria-hidden='true' />
                    {t('Minimum permissions')}
                  </h2>
                  <ul className='text-muted-foreground space-y-2 text-sm'>
                    <li className='flex gap-2'>
                      <Check
                        className='text-primary mt-0.5 size-4 shrink-0'
                        aria-hidden='true'
                      />
                      {t('Read the models available to your account')}
                    </li>
                    <li className='flex gap-2'>
                      <Check
                        className='text-primary mt-0.5 size-4 shrink-0'
                        aria-hidden='true'
                      />
                      {t('Call BoxAI models on behalf of your account')}
                    </li>
                  </ul>
                </section>
                {decision.isError ? (
                  <Alert variant='destructive'>
                    <AlertCircle aria-hidden='true' />
                    <AlertTitle>
                      {t('The decision could not be submitted')}
                    </AlertTitle>
                    <AlertDescription>
                      {t('Please try again.')}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
              <CardFooter className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                <Button
                  type='button'
                  variant='outline'
                  disabled={decision.isPending}
                  onClick={() => decision.mutate(false)}
                >
                  <X aria-hidden='true' />
                  {t('Reject')}
                </Button>
                <Button
                  type='button'
                  disabled={decision.isPending}
                  onClick={() => decision.mutate(true)}
                >
                  <Check aria-hidden='true' />
                  {decision.isPending
                    ? t('Submitting decision...')
                    : t('Approve')}
                </Button>
              </CardFooter>
            </Card>
          )}
        </main>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
