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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, Loader2, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { toIntlLocale } from '@/i18n/languages'

import { getDesktopSessions, revokeDesktopSession } from '../api'
import type { DesktopSession } from '../types'

const desktopSessionsQueryKey = ['profile', 'desktop-sessions'] as const

export function DesktopSessionsCard() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [sessionToRevoke, setSessionToRevoke] = useState<DesktopSession | null>(
    null
  )

  const sessionsQuery = useQuery({
    queryKey: desktopSessionsQueryKey,
    queryFn: async () => {
      const response = await getDesktopSessions()
      if (!response.success) throw new Error(response.message)
      return (response.data ?? []).filter((session) => !session.revoked_at)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await revokeDesktopSession(sessionId)
      if (!response.success) throw new Error(response.message)
    },
    onSuccess: async () => {
      setSessionToRevoke(null)
      toast.success(t('Desktop session revoked'))
      await queryClient.invalidateQueries({ queryKey: desktopSessionsQueryKey })
    },
  })

  const formatDate = (value: number) => {
    const date = new Date(value * 1000)
    if (Number.isNaN(date.getTime())) return '—'
    // i18n uses project codes like `zhCN`; Intl requires BCP-47 (`zh-CN`).
    return new Intl.DateTimeFormat(
      toIntlLocale(i18n.resolvedLanguage || i18n.language),
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(date)
  }

  let content: ReactNode = (
    <ul className='space-y-3' aria-label={t('Active desktop sessions')}>
      {sessionsQuery.data?.map((session) => (
        <li
          key={session.id}
          className='bg-muted/40 rounded-lg border p-3 sm:p-4'
        >
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <p className='truncate font-medium'>{session.client_name}</p>
              <dl className='mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2'>
                <div>
                  <dt className='text-muted-foreground'>{t('Created')}</dt>
                  <dd>{formatDate(session.created_at)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>
                    {t('Last refreshed')}
                  </dt>
                  <dd>{formatDate(session.last_refreshed_at)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{t('Expires')}</dt>
                  <dd>{formatDate(session.expires_at)}</dd>
                </div>
              </dl>
            </div>
            <Button
              variant='destructive'
              size='sm'
              className='w-full shrink-0 sm:w-auto'
              onClick={() => setSessionToRevoke(session)}
            >
              {t('Revoke')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )

  if (sessionsQuery.isPending) {
    content = (
      <div className='space-y-3' aria-busy='true'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
    )
  } else if (sessionsQuery.isError) {
    content = (
      <div className='flex flex-col items-center gap-3 py-6 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('Unable to load desktop sessions.')}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => sessionsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </div>
    )
  } else if (sessionsQuery.data.length === 0) {
    content = (
      <div className='py-6 text-center'>
        <p className='font-medium'>{t('No active desktop sessions')}</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t('Devices signed in to BoxAI Desktop will appear here.')}
        </p>
      </div>
    )
  }

  return (
    <>
      <TitledCard
        title={t('BoxAI Desktop Sessions')}
        description={t('Manage devices signed in to BoxAI Desktop.')}
        icon={<Laptop aria-hidden='true' />}
        iconTone='info'
        disableHoverEffect
        action={
          <Button
            variant='outline'
            size='sm'
            className='w-full sm:w-auto'
            onClick={() => sessionsQuery.refetch()}
            disabled={sessionsQuery.isFetching}
          >
            <RefreshCw
              aria-hidden='true'
              className={sessionsQuery.isFetching ? 'animate-spin' : undefined}
            />
            {sessionsQuery.isFetching ? t('Refreshing...') : t('Refresh')}
          </Button>
        }
      >
        {content}
      </TitledCard>

      <AlertDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => !open && setSessionToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Revoke desktop session?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This device will be signed out of BoxAI Desktop.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={revokeMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (sessionToRevoke) revokeMutation.mutate(sessionToRevoke.id)
              }}
            >
              {revokeMutation.isPending && (
                <Loader2 aria-hidden='true' className='animate-spin' />
              )}
              {t('Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
