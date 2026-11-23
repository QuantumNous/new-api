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
import {
  ChevronDown,
  CircleAlert,
  ListRestart,
  ShieldAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { listTaskPlugins } from '../api'
import {
  fetchMarketplaceIndex,
  getMarketplaceUpdates,
  marketplaceSourceKind,
  type MarketplaceUpdate,
} from '../lib/marketplace'
import {
  downloadMarketplaceRelease,
  installMarketplaceRelease,
  invalidateMarketplaceInstalls,
  MarketplaceActivationError,
  marketplaceErrorMessage,
} from '../lib/marketplace-install'
import type { MarketplaceSource } from '../types'
import { MarketplaceInstallDialog } from './marketplace-install-dialog'
import {
  MarketplaceUpdateRow,
  type UpdateResult,
} from './marketplace-update-row'

export type MarketplaceUpdateSelection = {
  source: MarketplaceSource
  updates: MarketplaceUpdate[]
}

export function MarketplaceUpdatesDialog(
  props: MarketplaceUpdateSelection & { onClose: () => void }
) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const client = useQueryClient()
  const [review, setReview] = useState<MarketplaceUpdate | null>(null)
  const [currentKey, setCurrentKey] = useState('')
  const [results, setResults] = useState(new Map<string, UpdateResult>())
  const ready = props.updates.filter((item) => !item.skip)
  const skipped = props.updates.filter((item) => item.skip)

  const mutation = useMutation({
    retry: false,
    meta: { errorToast: false },
    mutationFn: async () => {
      // A version may have been withdrawn or disabled while the list was open.
      // Only apply the versions and hashes the administrator actually reviewed.
      const [index, installed] = await Promise.all([
        client.fetchQuery({
          queryKey: ['task-plugin-marketplace', props.source.index_url],
          queryFn: () => fetchMarketplaceIndex(props.source.index_url),
          staleTime: 0,
          retry: false,
          meta: { errorToast: false },
        }),
        client.fetchQuery({
          queryKey: ['task-plugins'],
          queryFn: listTaskPlugins,
          staleTime: 0,
          retry: false,
          meta: { errorToast: false },
        }),
      ])
      const fresh = new Map(
        getMarketplaceUpdates(index, installed).map((item) => [
          item.plugin.key,
          item,
        ])
      )
      for (const item of ready) {
        const key = item.plugin.key
        const next = fresh.get(key)
        let result: UpdateResult
        if (
          !next ||
          next.skip ||
          next.installed.meta.version !== item.installed.meta.version ||
          next.installed.source_hash.toLowerCase() !==
            item.installed.source_hash.toLowerCase() ||
          next.target.version !== item.target.version ||
          next.target.sha256?.toLowerCase() !==
            item.target.sha256?.toLowerCase()
        ) {
          result = { status: 'skipped', reason: next?.skip ?? 'changed' }
        } else {
          setCurrentKey(key)
          try {
            const download = await downloadMarketplaceRelease(
              props.source,
              next.plugin,
              next.target
            )
            const detail = await installMarketplaceRelease(
              props.source,
              next.target,
              download
            )
            result = { status: 'updated', issues: detail.pricing_issues }
          } catch (error) {
            result = {
              status:
                error instanceof MarketplaceActivationError
                  ? 'activation-failed'
                  : 'failed',
              message: marketplaceErrorMessage(error),
            }
          }
        }
        setResults((previous) => new Map(previous).set(key, result))
      }
    },
    onSuccess: () => {
      setCurrentKey('')
      invalidateMarketplaceInstalls(
        client,
        ready.map((item) => item.plugin.key)
      )
    },
  })
  const busy = mutation.isPending
  const finished = mutation.isSuccess
  const outcomes = [...results.values()]
  const updated = outcomes.filter((item) => item.status === 'updated').length
  const skippedAfterReview = outcomes.filter(
    (item) => item.status === 'skipped'
  ).length
  const skipLabels = {
    disabled: t('Plugin is disabled'),
    revoked: t('This release was withdrawn.'),
    unverified: t('A release has no verifiable SHA-256 hash.'),
    modified: t('Installed code differs from the published release.'),
    changed: t(
      'The installed plugin or the marketplace release changed after review.'
    ),
  }
  const sourceKind = marketplaceSourceKind(props.source.index_url)
  const confirmLabel = t('Update all ({{total}})', {
    total: formatNumber(ready.length, locale),
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) props.onClose()
      }}
      showCloseButton={!busy}
      title={finished ? t('Update results') : t('Update installed plugins')}
      description={t('Updates from {{source}}', {
        source: props.source.name,
      })}
      contentClassName='sm:max-w-2xl'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={props.onClose} disabled={busy}>
            {finished || !ready.length ? t('Close') : t('Cancel')}
          </Button>
          {!finished && ready.length > 0 && (
            <Button disabled={busy} onClick={() => mutation.mutate()}>
              {busy ? (
                <Spinner aria-hidden='true' />
              ) : (
                <ListRestart aria-hidden='true' />
              )}
              {busy ? t('Updating...') : confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {finished && (
        <p role='status' className='text-sm font-medium'>
          {t('{{updated}} updated · {{failed}} failed · {{skipped}} skipped', {
            updated: formatNumber(updated, locale),
            failed: formatNumber(
              outcomes.length - updated - skippedAfterReview,
              locale
            ),
            skipped: formatNumber(skipped.length + skippedAfterReview, locale),
          })}
        </p>
      )}
      {busy && (
        <Progress
          value={results.size}
          max={ready.length}
          aria-label={t('Updating...')}
        />
      )}
      {mutation.isError && (
        <Alert variant='destructive' role='alert'>
          <CircleAlert />
          <AlertDescription>
            {marketplaceErrorMessage(mutation.error)}
          </AlertDescription>
        </Alert>
      )}
      {ready.length > 0 && (
        <ul className='divide-y overflow-hidden rounded-lg border'>
          {ready.map((item) => {
            const key = item.plugin.key
            const result = results.get(key)
            return (
              <MarketplaceUpdateRow
                key={key}
                item={item}
                result={result}
                current={currentKey === key}
                busy={busy}
                skipMessage={
                  result?.status === 'skipped'
                    ? skipLabels[result.reason]
                    : undefined
                }
                onReview={setReview}
              />
            )
          })}
        </ul>
      )}
      {skipped.length > 0 && (
        <Collapsible defaultOpen={ready.length === 0}>
          <CollapsibleTrigger
            render={
              <Button variant='ghost' size='sm' className='group max-w-full' />
            }
          >
            <ChevronDown
              aria-hidden='true'
              className='transition-transform group-aria-expanded:rotate-180'
            />
            {t('Skipped ({{total}})', {
              total: formatNumber(skipped.length, locale),
            })}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className='text-muted-foreground divide-y px-3 text-xs'>
              {skipped.map((item) => (
                <li
                  key={item.plugin.key}
                  className='flex flex-wrap justify-between gap-x-4 gap-y-1 py-2'
                >
                  <span className='font-mono break-all'>{item.plugin.key}</span>
                  <span>{item.skip && skipLabels[item.skip]}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
      {!finished && ready.length > 0 && (
        <div className='text-muted-foreground flex items-start gap-2 text-xs leading-relaxed'>
          <ShieldAlert className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
          <div>
            <p>
              {t(
                'Plugins can access channel credentials. Review the source and differences before installing.'
              )}
            </p>
            {sourceKind === 'community' && (
              <p>
                {t(
                  'Installing sends the plugin name, its version and a random ID of this gateway to newapi.ai to count installs.'
                )}
              </p>
            )}
          </div>
        </div>
      )}
      {review && (
        <MarketplaceInstallDialog
          reviewOnly
          target={{
            source: props.source,
            plugin: review.plugin,
            version: review.target.version,
            installState: {
              status: 'upgradable',
              installedVersion: review.installed.meta.version,
              latestVersion: review.target.version,
            },
          }}
          onOpenChange={(open) => {
            if (!open) setReview(null)
          }}
        />
      )}
    </Dialog>
  )
}
