/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppWindow, Link2Off } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import {
  getPartnerOAuthBindings,
  revokePartnerOAuthBinding,
  type PartnerOAuthBinding,
} from '../api'

const bindingsQueryKey = ['profile', 'partner-oauth-bindings'] as const

function scopeLabel(scope: string, t: (key: string) => string) {
  if (scope === 'account:read')
    return t('Read your account profile and balance')
  if (scope === 'credential:read') return t('Receive a dedicated API key')
  if (scope === 'payment:write') {
    return t('Create top-up orders that you confirm on the payment page')
  }
  if (scope === 'offline_access') return t('Stay connected for 30 days')
  return scope
}

export function AuthorizedAppsCard() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const [revokeTarget, setRevokeTarget] = useState<PartnerOAuthBinding | null>(
    null
  )

  const bindingsQuery = useQuery({
    queryKey: bindingsQueryKey,
    queryFn: async () => {
      const response = await getPartnerOAuthBindings()
      if (!response.success) {
        throw createServerError(
          response,
          t('Failed to load authorized applications')
        )
      }
      return response.data ?? []
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (bindingId: string) => {
      const response = await revokePartnerOAuthBinding(bindingId)
      if (!response.success) {
        throw createServerError(response, t('Failed to revoke authorization'))
      }
    },
    onSuccess: async () => {
      setRevokeTarget(null)
      toast.success(t('Authorization revoked'))
      await queryClient.invalidateQueries({ queryKey: bindingsQueryKey })
    },
    onError: (error: Error) => handleServerError(error),
  })

  const bindings = bindingsQuery.data ?? []
  let content: ReactNode
  if (bindingsQuery.isLoading) {
    content = (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
      </div>
    )
  } else if (bindingsQuery.isError) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <AppWindow />
          </EmptyMedia>
          <EmptyTitle>{t('Unable to load authorized applications')}</EmptyTitle>
          <EmptyDescription>
            {t('Refresh the list and try again.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type='button'
          variant='outline'
          onClick={() => bindingsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </Empty>
    )
  } else if (bindings.length === 0) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <AppWindow />
          </EmptyMedia>
          <EmptyTitle>{t('No authorized applications')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'Third-party assistants you approve will appear here so you can revoke them.'
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = (
      <div className='flex flex-col'>
        {bindings.map((binding, index) => (
          <div key={binding.binding_id}>
            {index > 0 && <Separator />}
            <div className='flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between'>
              <div className='min-w-0 space-y-1'>
                <p className='font-medium'>{binding.client_name}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('Valid until {{date}}', {
                    date: new Date(binding.expires_at * 1000).toLocaleString(
                      locale
                    ),
                  })}
                </p>
                <ul className='text-muted-foreground list-disc space-y-0.5 pl-4 text-xs'>
                  {binding.scopes.map((scope) => (
                    <li key={scope}>{scopeLabel(scope, t)}</li>
                  ))}
                </ul>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setRevokeTarget(binding)}
              >
                <Link2Off className='size-4' aria-hidden />
                {t('Revoke')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <Card data-card-hover='false'>
        <CardHeader>
          <CardTitle>{t('Authorized applications')}</CardTitle>
          <CardDescription>
            {t(
              'Review third-party assistants that can spend your balance with a dedicated API key.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title={t('Revoke this authorization?')}
        desc={t(
          'The assistant will lose access immediately, and the issued API key will be disabled.'
        )}
        confirmText={t('Revoke')}
        destructive
        handleConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.binding_id)
        }}
        isLoading={revokeMutation.isPending}
      />
    </>
  )
}
