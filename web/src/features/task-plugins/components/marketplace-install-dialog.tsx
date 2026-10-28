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
import { AlertTriangle, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getTaskPlugin, installMarketplacePlugin } from '../api'
import {
  findMarketplaceVersion,
  resolvePluginSourceUrl,
  type InstallState,
} from '../lib/marketplace'
import {
  computeSourceSha256,
  fetchPluginSourceText,
  PluginSourceFetchError,
} from '../lib/plugin-url'
import type { MarketplacePlugin, MarketplaceSource } from '../types'
import { JavaScriptViewer } from './javascript-viewer'
import { MarketplaceCapabilities } from './marketplace-capabilities'
import { SourceDiff } from './source-diff'

export type MarketplaceInstallTarget = {
  source: MarketplaceSource
  plugin: MarketplacePlugin
  version: string
  installState: InstallState
}

type MarketplaceInstallDialogProps = {
  target: MarketplaceInstallTarget | null
  onOpenChange: (open: boolean) => void
}

export function MarketplaceInstallDialog(props: MarketplaceInstallDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const target = props.target
  const pluginKey = target?.plugin.key ?? ''
  const entry = target
    ? findMarketplaceVersion(target.plugin, target.version)
    : undefined
  const isUpgrade = target
    ? target.installState.status !== 'not_installed'
    : false

  const sourceQuery = useQuery({
    queryKey: [
      'task-plugin-marketplace-source',
      target?.source.index_url,
      pluginKey,
      target?.version,
    ],
    enabled: Boolean(target && entry),
    retry: false,
    queryFn: async () => {
      if (!target || !entry) throw new Error('missing marketplace entry')
      const url = resolvePluginSourceUrl(target.source.index_url, entry.path)
      if (!url) {
        throw new Error(
          t('This plugin path does not resolve within the source repository.')
        )
      }
      const text = await fetchPluginSourceText(url)
      // Computed for display only. The upload request carries the index hash and
      // the server re-hashes what it received, so a tampered browser cannot pass
      // a mismatched source off as verified.
      const digest = await computeSourceSha256(text)
      return { url, text, digest }
    },
  })

  // The installed source is the diff baseline for an upgrade.
  const installedQuery = useQuery({
    queryKey: ['task-plugin', pluginKey],
    queryFn: () => getTaskPlugin(pluginKey),
    enabled: Boolean(target) && isUpgrade,
  })

  const installMutation = useMutation({
    mutationFn: () => {
      if (!target || !sourceQuery.data) throw new Error('source not fetched')
      return installMarketplacePlugin({
        source: sourceQuery.data.text,
        sourceSha256: entry?.sha256,
        remark: `${target.source.name} v${target.version}`,
      })
    },
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      queryClient.invalidateQueries({ queryKey: ['task-plugin', pluginKey] })
      queryClient.invalidateQueries({
        queryKey: ['task-plugin-versions', pluginKey],
      })
      toast.success(
        t('Installed {{name}} v{{version}}', {
          name: detail.meta.name,
          version: detail.meta.version,
        })
      )
      props.onOpenChange(false)
    },
  })

  const fetchError = sourceQuery.error
  let fetchErrorMessage = ''
  if (fetchError instanceof PluginSourceFetchError) {
    fetchErrorMessage =
      fetchError.reason === 'too_large'
        ? t('Plugin source exceeds the 1 MiB limit.')
        : t(
            'Could not fetch the plugin source from this browser. The host may block cross-origin requests or be unreachable.'
          )
  } else if (fetchError) {
    fetchErrorMessage = fetchError.message
  }

  const digestMismatch = Boolean(
    entry?.sha256 &&
    sourceQuery.data?.digest &&
    sourceQuery.data.digest.toLowerCase() !== entry.sha256.toLowerCase()
  )

  let confirmLabel = t('Install and enable')
  if (installMutation.isPending) confirmLabel = t('Installing...')
  else if (isUpgrade) confirmLabel = t('Upgrade and enable')

  // Rendering the body needs a target; the dialog itself is driven by its
  // presence, so an absent target simply means the dialog is closed.
  if (!target) return null

  return (
    <Dialog open onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isUpgrade
              ? t('Upgrade {{name}}', { name: target.plugin.name })
              : t('Install {{name}}', { name: target.plugin.name })}
          </DialogTitle>
          <DialogDescription>
            {t('{{key}} · version {{version}} · from {{source}}', {
              key: pluginKey,
              version: target.version,
              source: target.source.name,
            })}
          </DialogDescription>
        </DialogHeader>

        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('Third-party plugin risk')}</AlertTitle>
          <AlertDescription>
            {t(
              'Uploading a plugin is an administrator-level trust decision. A plugin can access channel credentials and shape upstream requests. Review its source and diff before activation.'
            )}
          </AlertDescription>
        </Alert>

        <MarketplaceCapabilities plugin={target.plugin} version={entry} />

        {!entry?.sha256 && (
          <Alert>
            <AlertTitle>{t('No integrity hash')}</AlertTitle>
            <AlertDescription>
              {t(
                'This source does not publish a sha256 for this version, so the downloaded source cannot be pinned to what the source intended.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {digestMismatch && (
          <Alert variant='destructive'>
            <AlertTriangle />
            <AlertTitle>{t('Integrity check failed')}</AlertTitle>
            <AlertDescription>
              {t(
                'The downloaded source does not match the sha256 declared in the index. Do not install it.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {sourceQuery.isLoading && (
          <div className='flex items-center gap-2 text-sm'>
            <Spinner />
            {t('Fetching plugin source...')}
          </div>
        )}

        {fetchErrorMessage && (
          <p role='alert' className='text-destructive text-sm'>
            {fetchErrorMessage}
          </p>
        )}

        {sourceQuery.data && (
          <Tabs defaultValue={isUpgrade ? 'diff' : 'source'}>
            <TabsList>
              <TabsTrigger value='source'>{t('Source')}</TabsTrigger>
              {isUpgrade && (
                <TabsTrigger value='diff'>{t('Source diff')}</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value='source'>
              <JavaScriptViewer
                value={sourceQuery.data.text}
                className='h-[28rem] overflow-hidden rounded-md border'
              />
            </TabsContent>
            {isUpgrade && (
              <TabsContent value='diff' className='space-y-2'>
                {installedQuery.isLoading && (
                  <div className='flex items-center gap-2 text-sm'>
                    <Spinner />
                    {t('Loading installed source...')}
                  </div>
                )}
                {installedQuery.data && (
                  <>
                    <p className='text-muted-foreground text-xs'>
                      {t('Installed v{{from}} → marketplace v{{to}}', {
                        from: installedQuery.data.meta.version,
                        to: target.version,
                      })}
                    </p>
                    <SourceDiff
                      before={installedQuery.data.source}
                      after={sourceQuery.data.text}
                    />
                  </>
                )}
                {installedQuery.error && (
                  <p role='alert' className='text-destructive text-sm'>
                    {installedQuery.error.message}
                  </p>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}

        {target.installState.status === 'diverged' && (
          <Alert>
            <AlertTitle>
              {t('Installed version is not in this index')}
            </AlertTitle>
            <AlertDescription>
              {t(
                'v{{installed}} is installed but this source does not list it. Installing replaces it with v{{target}}.',
                {
                  installed: target.installState.installedVersion,
                  target: target.version,
                }
              )}
            </AlertDescription>
          </Alert>
        )}

        {installMutation.error && (
          <div className='space-y-1'>
            <p className='text-destructive text-sm font-medium'>
              {t('The gateway rejected this plugin')}
            </p>
            {/* Verbatim: preflight rejections name the conflicting plugin. */}
            <p className='text-destructive text-sm whitespace-pre-wrap'>
              {installMutation.error.message}
            </p>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Marketplace installs never force past a conflict. Resolve it on the task plugins page, then install again.'
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={
              !sourceQuery.data || digestMismatch || installMutation.isPending
            }
            onClick={() => installMutation.mutate()}
          >
            <Download />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
