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
import { KeyRound, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SecureVerificationDialog } from '@/features/auth/secure-verification'
import { AuditLogViewer } from '@/features/usage-logs/audit/components/audit-log-viewer'
import { isPersianIntlLocale, toIntlLocale } from '@/i18n/languages'
import { formatGregorianTitle, formatTimestampToDate } from '@/lib/format'

import type { AccessTokenItem as AccessToken } from '../api'
import { useAccessTokens } from '../hooks/use-access-tokens'
import { AccessTokenItem } from './access-token-item'
import { AccessTokenCreateDialog } from './dialogs/access-token-create-dialog'
import { AccessTokenDialog } from './dialogs/access-token-dialog'
import { AccessTokenEditDialog } from './dialogs/access-token-edit-dialog'

export function AccessTokensCard() {
  const { t, i18n } = useTranslation()
  const access = useAccessTokens()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const timeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale]
  )
  // Persian shows numeric Solar Hijri dates, as everywhere else in the app.
  const formatTime = (seconds: number) =>
    isPersianIntlLocale(locale)
      ? formatTimestampToDate(seconds, 'seconds', locale)
      : timeFormat.format(new Date(seconds * 1000))
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<
    AccessToken | 'legacy' | null
  >(null)
  const [editTarget, setEditTarget] = useState<AccessToken | null>(null)
  // undefined shows every access record; a token ref opens the viewer on it.
  const [records, setRecords] = useState<{ tokenRef?: string } | null>(null)
  const catalog = access.catalog.data
  const list = access.list.data
  const resourceLabels = useMemo(
    () =>
      new Map(
        catalog?.groups.flatMap((group) =>
          group.resources.map(
            (resource) => [resource.resource, resource.label_key] as const
          )
        ) ?? []
      ),
    [catalog]
  )
  const atLimit = !!list && !!catalog && list.items.length >= catalog.max_tokens
  const now = Date.now()

  const confirmRevoke = async () => {
    const target = revokeTarget
    if (access.pending || !target) return
    setRevokeTarget(null)
    if (target === 'legacy') await access.revokeLegacy()
    else await access.revoke(target.id)
  }

  let content: ReactNode
  if (access.list.isPending) {
    content = (
      <div role='status'>
        <LoadingState size='sm' className='min-h-24' />
      </div>
    )
  } else if (access.list.isError || !list) {
    content = (
      <div role='alert'>
        <ErrorState
          className='min-h-40'
          title={t('Failed to load access tokens')}
          onRetry={() => void access.list.refetch()}
        />
      </div>
    )
  } else {
    const legacy = list.legacy
    content = (
      <div className='space-y-3'>
        {legacy && (
          <div className='space-y-2 rounded-md border p-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline'>{t('Legacy token')}</Badge>
              <code className='text-muted-foreground text-xs'>
                …{legacy.token_hint}
              </code>
            </div>
            <p className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
              {legacy.created_at ? (
                <span title={formatGregorianTitle(legacy.created_at, locale)}>
                  {t('Created {{time}}', {
                    time: formatTime(legacy.created_at),
                  })}
                </span>
              ) : null}
              <span
                title={formatGregorianTitle(
                  legacy.last_used_at ?? undefined,
                  locale
                )}
              >
                {legacy.last_used_at
                  ? t('Last used {{time}}', {
                      time: formatTime(legacy.last_used_at),
                    })
                  : t('Never used')}
              </span>
            </p>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p
                className='text-sm'
                title={formatGregorianTitle(legacy.retire_at, locale)}
              >
                {t(
                  'The legacy token stops working on {{date}}. Create a new token to replace it.',
                  { date: formatTime(legacy.retire_at) }
                )}
              </p>
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setRecords({ tokenRef: legacy.token_ref })}
                >
                  {t('Access records')}
                </Button>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={access.pending}
                  onClick={() => setRevokeTarget('legacy')}
                >
                  {t('Revoke')}
                </Button>
              </div>
            </div>
          </div>
        )}
        {list.items.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            className='min-h-40'
            title={t('No access tokens')}
          />
        ) : (
          <div className='flex flex-col'>
            {list.items.map((token, index) => (
              <div key={token.id}>
                {index > 0 && <Separator />}
                <AccessTokenItem
                  token={token}
                  resourceLabels={resourceLabels}
                  formatTime={formatTime}
                  now={now}
                  disabled={access.pending}
                  canEdit={!!catalog}
                  onEdit={setEditTarget}
                  onShowRecords={(target) =>
                    setRecords({ tokenRef: target.token_ref })
                  }
                  onRevoke={setRevokeTarget}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Card data-card-hover='false'>
        <CardHeader>
          <CardTitle>{t('Access tokens')}</CardTitle>
          <CardDescription>
            {t(
              'Use access tokens to call the dashboard API from scripts. Each token only has the permissions you select.'
            )}
          </CardDescription>
          <CardAction className='flex flex-wrap justify-end gap-2'>
            <Button size='sm' variant='outline' onClick={() => setRecords({})}>
              {t('Access records')}
            </Button>
            <Button
              size='sm'
              disabled={!catalog || atLimit || access.pending}
              onClick={() => setCreateOpen(true)}
            >
              <Plus data-icon='inline-start' />
              {t('Create access token')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className='space-y-2'>
          {atLimit && catalog && (
            <p className='text-muted-foreground text-xs'>
              {t('You can create up to {{count}} access tokens', {
                count: catalog.max_tokens,
              })}
            </p>
          )}
          {content}
        </CardContent>
      </Card>
      {catalog && (
        <AccessTokenCreateDialog
          open={createOpen}
          hidden={access.showVerification}
          catalog={catalog}
          pending={access.pending}
          onOpenChange={setCreateOpen}
          onCreate={access.create}
        />
      )}
      {catalog && editTarget && (
        <AccessTokenEditDialog
          key={editTarget.id}
          token={editTarget}
          hidden={access.showVerification}
          catalog={catalog}
          pending={access.updatePending}
          onClose={() => setEditTarget(null)}
          onSave={(input) => access.update(editTarget.id, input)}
        />
      )}
      {access.createdToken && (
        <AccessTokenDialog
          token={access.createdToken}
          onClose={access.clearCreatedToken}
        />
      )}
      <SecureVerificationDialog {...access.verificationDialogProps} />
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !access.pending) setRevokeTarget(null)
        }}
        title={t('Revoke')}
        desc={t(
          'Revoke this access token? Scripts using it stop working immediately.'
        )}
        confirmText={t('Revoke')}
        destructive
        isLoading={access.pending}
        handleConfirm={() => void confirmRevoke()}
      />
      <Sheet
        open={records !== null}
        onOpenChange={(open) => {
          if (!open) setRecords(null)
        }}
      >
        <SheetContent className='w-full sm:max-w-5xl' showCloseButton={false}>
          <SheetHeader className='border-b pr-20'>
            <SheetTitle>{t('Access records')}</SheetTitle>
            <SheetDescription>
              {t(
                'Audit records start after this feature was enabled. Earlier records remain in Common Logs.'
              )}
            </SheetDescription>
          </SheetHeader>
          <SheetClose
            render={
              <Button
                size='sm'
                variant='ghost'
                className='absolute top-3 right-3'
              />
            }
          >
            {t('Close')}
          </SheetClose>
          <div className='min-h-0 flex-1 px-4 pb-4'>
            {records && (
              <AuditLogViewer
                key={records.tokenRef ?? 'all'}
                scope='self'
                accessOnly
                currentTokenRef={records.tokenRef}
                defaultTokenScope={records.tokenRef ? 'current' : undefined}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
