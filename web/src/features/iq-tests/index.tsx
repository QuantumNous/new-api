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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/components/main'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { runIQTests } from './api'
import { IQPreview } from './preview'
import {
  iqKeys,
  isCurrentIQScope,
  useIQResults,
  useIQScopeCleanup,
  useIQViewerScope,
} from './queries'
import { IQResultCard, IQStatusLabel, IQTime } from './result-card'
import { IQSettings } from './settings'
import { artifactRevision } from './types'
import { useLiveIQPreviews } from './use-live-previews'

export function IQTestsPage() {
  const scope = useIQViewerScope()
  // Synchronous key changes unmount dialogs, form input, frames and observers
  // before another viewer can render. No previous-data placeholders are used.
  if (!scope) return null
  return <IQGallery key={scope} scope={scope} />
}

function IQGallery(props: { scope: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const canRead = Boolean(
    user && user.role >= ROLE.ADMIN && hasPermission(user, 'channel', 'read')
  )
  const canWrite = Boolean(
    user && user.role >= ROLE.ADMIN && hasPermission(user, 'channel', 'write')
  )
  const canRun = Boolean(
    user && user.role >= ROLE.ADMIN && hasPermission(user, 'channel', 'operate')
  )
  const client = useQueryClient()
  const query = useIQResults(props.scope)
  useIQScopeCleanup(props.scope)
  const [selected, setSelected] = useState<string | null>(null)
  const [settings, setSettings] = useState(false)
  const [confirmRun, setConfirmRun] = useState(false)
  const data = query.isError ? undefined : query.data
  const results =
    data?.groups.flatMap((group) =>
      group.models.flatMap((card) => (card.latest ? [card.latest] : []))
    ) ?? []
  const expanded = results.find(
    (result) =>
      result.status === 'success' && artifactRevision(result) === selected
  )
  const previews = useLiveIQPreviews(
    results
      .filter((result) => result.status === 'success')
      .map(artifactRevision),
    Boolean(expanded) || settings || confirmRun || !data
  )
  const run = useMutation({
    mutationFn: runIQTests,
    retry: false,
    onSuccess: (result) => {
      if (!isCurrentIQScope(props.scope)) return
      setConfirmRun(false)
      toast.success(
        result.created ? t('IQ run queued') : t('An IQ run is already active')
      )
      void client.invalidateQueries({ queryKey: iqKeys.results(props.scope) })
    },
  })
  return (
    <Main className='overflow-y-auto'>
      <div className='mx-auto w-full max-w-7xl space-y-8 p-4 pb-16 sm:p-8'>
        <header className='flex flex-wrap items-start justify-between gap-4'>
          <div className='max-w-2xl space-y-2'>
            <h1 className='text-2xl font-semibold'>{t('IQ tests')}</h1>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Compare the latest HTML/SVG artwork from selected text models, grouped by routing group. Not a standardized IQ score.'
              )}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('Refresh')}
            </Button>
            {canRead && (
              <Button variant='outline' onClick={() => setSettings(true)}>
                {t('IQ test settings')}
              </Button>
            )}
            {canRun && (
              <Button
                onClick={() => setConfirmRun(true)}
                disabled={run.isPending || Boolean(data?.active_run)}
              >
                {t('Run now')}
              </Button>
            )}
          </div>
        </header>
        {query.isPending && <LoadingState />}
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {data && (
          <>
            <section
              aria-label={t('Run status')}
              className='bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm'
            >
              <Badge variant='secondary'>
                {data.schedule_enabled
                  ? t('Schedule enabled')
                  : t('Schedule disabled')}
              </Badge>
              <p>
                {t('Next run')}: <IQTime seconds={data.next_run_at} /> ·{' '}
                {t('Beijing time')}
              </p>
              {data.active_run && (
                <p role='status'>
                  {t('Current run')}:{' '}
                  <IQStatusLabel status={data.active_run.status} /> ·{' '}
                  {t('{{completed}} / {{total}} completed', {
                    completed: data.active_run.completed,
                    total: data.active_run.total,
                  })}
                </p>
              )}
            </section>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Only the latest result is kept. Previous artwork stays dated until its replacement finishes. Times are shown in Beijing time.'
              )}
            </p>
            {data.groups.length === 0 && (
              <EmptyState
                title={t('No IQ results available')}
                description={t(
                  'An administrator can select models and run a test. Only your accessible groups appear here.'
                )}
              />
            )}
            <div ref={previews.root} className='space-y-8'>
              {data.groups.map((group) => (
                <section
                  key={group.group}
                  className='space-y-4'
                  aria-label={group.group}
                >
                  <h2 className='text-xl font-semibold break-all'>
                    {group.group}
                  </h2>
                  <div className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'>
                    {group.models.map((card) => (
                      <IQResultCard
                        key={card.model}
                        scope={props.scope}
                        card={card}
                        live={Boolean(
                          card.latest &&
                          previews.live.includes(artifactRevision(card.latest))
                        )}
                        onOpen={setSelected}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
        {expanded && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setSelected(null)
            }}
            title={t('Artwork by {{model}}', { model: expanded.model })}
            description={
              <>
                {expanded.group} · <IQTime seconds={expanded.completed_at} /> ·{' '}
                {t('Beijing time')}
              </>
            }
            contentClassName='sm:max-w-6xl'
            showCloseButton={false}
            footer={
              <Button variant='outline' onClick={() => setSelected(null)}>
                {t('Close')}
              </Button>
            }
          >
            <p className='text-muted-foreground mb-3 text-xs'>
              {t(
                'Isolated active artwork. External assets are blocked; scripts may still consume browser resources or navigate their own frame.'
              )}
            </p>
            <IQPreview
              key={artifactRevision(expanded)}
              scope={props.scope}
              result={expanded}
              expanded
            />
          </Dialog>
        )}
        {settings && canRead && (
          <IQSettings
            scope={props.scope}
            canWrite={canWrite}
            onClose={() => setSettings(false)}
          />
        )}
        {canRun && (
          <ConfirmDialog
            open={confirmRun}
            onOpenChange={setConfirmRun}
            title={t('Run IQ tests?')}
            desc={t(
              'Run the saved targets once using site resources. This may incur provider costs. No retries or extra samples.'
            )}
            confirmText={t('Run now')}
            isLoading={run.isPending}
            handleConfirm={() => run.mutate()}
          />
        )}
      </div>
    </Main>
  )
}
