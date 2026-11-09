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
import { getRouteApi } from '@tanstack/react-router'
import { CircleHelp, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NodeSyncIndicator } from '@/features/system-info/components/node-sync-indicator'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getTaskPluginEnabledOption,
  listTaskPlugins,
  setTaskPluginEnabledOption,
} from './api'
import { MarketplacePanel } from './components/marketplace-panel'
import { PluginDetailSheet } from './components/plugin-detail-sheet'
import { PluginsTable } from './components/plugins-table'
import { UploadDialog } from './components/upload-dialog'
import type { PluginKind } from './lib/plugin-kinds'
import { localizedPluginName } from './lib/plugin-name'
import type { TaskPluginListItem } from './types'

const route = getRouteApi('/_authenticated/task-plugins/')

export function TaskPlugins() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [detail, setDetail] = useState<TaskPluginListItem | null>(null)
  const [tab, setTab] = useState('installed')
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const enabledQuery = useQuery({
    queryKey: ['task-plugin-enabled'],
    queryFn: getTaskPluginEnabledOption,
  })
  const pluginsQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  const enabledMutation = useMutation({
    mutationFn: setTaskPluginEnabledOption,
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['task-plugin-enabled'], enabled)
      toast.success(t('Plugin setting updated'))
    },
    onError: (error) => handleServerError(error),
  })
  const setKind = (kind: PluginKind) =>
    void navigate({ search: (prev) => ({ ...prev, kind }) })
  const openUpload = (key?: string) => {
    setUploadKey(key ?? null)
    setUploadOpen(true)
  }
  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Plugins')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <NodeSyncIndicator
            topics={['plugins', 'options']}
            pluginNames={Object.fromEntries(
              (pluginsQuery.data ?? []).map((plugin) => [
                plugin.meta.key,
                localizedPluginName(plugin.meta, i18n.language),
              ])
            )}
          />
          <div className='flex items-center gap-2'>
            <Switch
              id='task-plugin-enabled-switch'
              checked={enabledQuery.data ?? false}
              disabled={enabledQuery.isLoading || enabledMutation.isPending}
              onCheckedChange={(checked) => {
                if (checked) enabledMutation.mutate(true)
                else setConfirmDisable(true)
              }}
            />
            <Label
              htmlFor='task-plugin-enabled-switch'
              className='hidden text-sm font-normal sm:inline'
            >
              {t('Enable plugins')}
            </Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Built-in and custom plugins')}
                  />
                }
              >
                <CircleHelp className='text-muted-foreground' />
              </PopoverTrigger>
              <PopoverContent align='end' className='w-80'>
                <div className='space-y-2 text-sm'>
                  <p className='font-medium'>{t('Enable plugins')}</p>
                  <p className='text-muted-foreground'>
                    {t('Turn this off to stop all plugins.')}
                  </p>
                  <p className='font-medium'>
                    {t('Built-in and custom plugins')}
                  </p>
                  <p className='text-muted-foreground'>
                    {t(
                      'A custom version replaces the built-in plugin of the same name. Deleting or turning off the custom version brings the built-in one back.'
                    )}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {tab === 'installed' && (
            <Button onClick={() => openUpload()}>
              <Upload />
              {t('Upload plugin')}
            </Button>
          )}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <Tabs
            value={tab}
            onValueChange={setTab}
            className='flex h-full min-h-0 flex-col gap-4'
          >
            <div className='shrink-0 border-b'>
              <TabsList
                variant='line'
                className='justify-start gap-4 group-data-horizontal/tabs:h-10'
              >
                <TabsTrigger value='installed'>{t('Installed')}</TabsTrigger>
                <TabsTrigger value='marketplace'>
                  {t('Marketplace')}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='installed' className='min-h-0 flex-1'>
              <PluginsTable
                kind={search.kind}
                onKindChange={setKind}
                onDetails={setDetail}
                onUpload={(key) => openUpload(key)}
              />
            </TabsContent>
            <TabsContent value='marketplace' className='min-h-0 flex-1'>
              <MarketplacePanel kind={search.kind} onKindChange={setKind} />
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <PluginDetailSheet
        key={detail?.meta.key ?? ''}
        plugin={detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        initialKey={uploadKey ?? undefined}
      />
      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={t('Turn off all plugins?')}
        desc={
          <div className='space-y-2'>
            <p>
              {t(
                'All plugins stop at once. Unfinished tasks end when they time out.'
              )}
            </p>
            <ul className='list-disc pl-5'>
              {(pluginsQuery.data ?? [])
                .filter((plugin) => plugin.source === 'override')
                .map((plugin) => (
                  <li key={plugin.meta.key}>
                    {localizedPluginName(plugin.meta, i18n.language)} (
                    {plugin.meta.key}):{' '}
                    {t('{{channels}} channels, {{tasks}} in-flight tasks', {
                      channels: plugin.channel_count,
                      tasks: plugin.in_flight_count,
                    })}
                  </li>
                ))}
            </ul>
          </div>
        }
        destructive
        handleConfirm={() =>
          enabledMutation.mutate(false, {
            onSuccess: () => setConfirmDisable(false),
          })
        }
        confirmText={t('Disable')}
      />
    </>
  )
}
