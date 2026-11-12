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
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getEnabledModels, getGroups } from '@/features/channels/api'
import { NodeSyncIndicator } from '@/features/system-info/components/node-sync-indicator'
import {
  listRequestPluginInstances,
  listRequestPluginOptions,
  saveRequestPluginInstances,
} from '@/features/task-plugins/api'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import { RequestPluginDryRunDialog } from '@/features/task-plugins/components/request-plugin-dry-run-dialog'
import { RequestPluginInstanceEditor } from '@/features/task-plugins/components/request-plugin-instance-editor'
import { localizedPluginName } from '@/features/task-plugins/lib/plugin-name'
import {
  REQUEST_PLUGIN_INSTANCES_QUERY_KEY,
  REQUEST_PLUGIN_OPTIONS_QUERY_KEY,
} from '@/features/task-plugins/lib/request-plugins'
import type { RequestPluginInstance } from '@/features/task-plugins/types'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

/**
 * The request processing page: the instances in the order they run. Every
 * change saves the whole list at once.
 */
export function RequestProcessing() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RequestPluginInstance | 'new' | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] =
    useState<RequestPluginInstance | null>(null)
  const [dryRunOpen, setDryRunOpen] = useState(false)
  const instancesQuery = useQuery({
    queryKey: REQUEST_PLUGIN_INSTANCES_QUERY_KEY,
    queryFn: listRequestPluginInstances,
    meta: { errorToast: false },
  })
  const pluginsQuery = useQuery({
    queryKey: REQUEST_PLUGIN_OPTIONS_QUERY_KEY,
    queryFn: listRequestPluginOptions,
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
  })
  const modelsQuery = useQuery({
    queryKey: ['enabled-models'],
    queryFn: async () => requireServerSuccess(await getEnabledModels()),
  })
  const onSaved = (instances: RequestPluginInstance[]) =>
    queryClient.setQueryData(REQUEST_PLUGIN_INSTANCES_QUERY_KEY, instances)
  const listMutation = useMutation({
    mutationFn: saveRequestPluginInstances,
    onSuccess: (instances) => {
      onSaved(instances)
      setDeleteTarget(null)
    },
  })
  const editorMutation = useMutation({
    mutationFn: saveRequestPluginInstances,
    meta: { errorToast: false },
    onSuccess: (instances) => {
      onSaved(instances)
      setEditing(null)
    },
  })
  const instances = instancesQuery.data ?? []
  const plugins = pluginsQuery.data ?? []
  const instanceCounts: Record<string, number> = {}
  for (const instance of instances) {
    instanceCounts[instance.plugin] = (instanceCounts[instance.plugin] ?? 0) + 1
  }
  const groups = groupsQuery.data?.data ?? []
  const models = modelsQuery.data?.data ?? []
  const busy = listMutation.isPending || editorMutation.isPending

  const move = (index: number, offset: -1 | 1) => {
    const next = [...instances]
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    listMutation.mutate(next)
  }
  const openEditor = (instance: RequestPluginInstance | 'new') => {
    editorMutation.reset()
    setEditing(instance)
  }

  let content = null
  if (instancesQuery.isPending) content = <LoadingState />
  else if (instancesQuery.isError) {
    content = (
      <ErrorState
        description={getServerErrorMessage(instancesQuery.error)}
        onRetry={() => void instancesQuery.refetch()}
      />
    )
  } else if (instances.length === 0) {
    content = (
      <EmptyState
        title={t('No request processing yet')}
        description={t(
          'Add an instance to check or change requests before they reach the model.'
        )}
      />
    )
  } else {
    content = (
      <div className='overflow-x-auto rounded-md border'>
        <Table aria-label={t('Request processing')}>
          <TableHeader>
            <TableRow>
              <TableHead className='w-24'>{t('Order')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Plugin')}</TableHead>
              <TableHead>{t('Applies to')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((instance, index) => {
              const plugin = plugins.find(
                (item) => item.key === instance.plugin
              )
              let scope = t('Channels only')
              if (instance.global) scope = t('All requests')
              else if (instance.groups.length) {
                scope = instance.groups.join(', ')
              }
              return (
                <TableRow key={instance.id || index}>
                  <TableCell>
                    <div className='flex items-center gap-1'>
                      <span className='text-muted-foreground w-5 text-xs tabular-nums'>
                        {index + 1}
                      </span>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        disabled={busy || index === 0}
                        aria-label={t('Move {{name}} up', {
                          name: instance.name,
                        })}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden='true' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        disabled={busy || index === instances.length - 1}
                        aria-label={t('Move {{name}} down', {
                          name: instance.name,
                        })}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden='true' />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className='max-w-48 font-medium break-words whitespace-normal'>
                    {instance.name}
                  </TableCell>
                  <TableCell>
                    <div className='flex min-w-0 items-center gap-2'>
                      <PluginIcon
                        plugin={plugin ?? { key: instance.plugin }}
                        size={18}
                      />
                      <span className='min-w-0 truncate'>
                        {plugin
                          ? localizedPluginName(plugin, i18n.language)
                          : instance.plugin}
                      </span>
                      {!plugin && pluginsQuery.isSuccess && (
                        <Badge variant='secondary'>
                          {t('Plugin disabled')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-56 break-words whitespace-normal'>
                    {scope}
                    {/* Servers before the model filter send no list. */}
                    {(instance.models ?? []).length > 0 && (
                      <span className='text-muted-foreground block text-xs'>
                        {t('Models: {{models}}', {
                          models: instance.models.join(', '),
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={instance.enabled}
                      disabled={busy}
                      aria-label={t('Enable {{name}}', { name: instance.name })}
                      onCheckedChange={(checked) =>
                        listMutation.mutate(
                          instances.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, enabled: checked }
                              : item
                          )
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        disabled={busy}
                        aria-label={t('Edit {{name}}', { name: instance.name })}
                        onClick={() => openEditor(instance)}
                      >
                        <Pencil aria-hidden='true' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        disabled={busy}
                        aria-label={t('Delete {{name}}', {
                          name: instance.name,
                        })}
                        onClick={() => setDeleteTarget(instance)}
                      >
                        <Trash2 aria-hidden='true' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Request processing')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <NodeSyncIndicator topics={['options']} />
          <Button
            variant='outline'
            disabled={!instancesQuery.isSuccess}
            onClick={() => setDryRunOpen(true)}
          >
            <Play aria-hidden='true' />
            {t('Dry run')}
          </Button>
          <Button
            disabled={!instancesQuery.isSuccess || busy}
            onClick={() => openEditor('new')}
          >
            <Plus aria-hidden='true' />
            {t('Add')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            <p className='text-muted-foreground text-sm'>
              {t(
                "Instances run from top to bottom. Those for all requests run first, then those for the request's group, then those a channel adds."
              )}
            </p>
            {content}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <RequestPluginInstanceEditor
        open={editing !== null}
        instance={editing === 'new' ? null : editing}
        plugins={plugins}
        instanceCounts={instanceCounts}
        groups={groups}
        models={models}
        saving={editorMutation.isPending}
        error={
          editorMutation.isError
            ? getServerErrorMessage(editorMutation.error)
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSave={(instance) => {
          const index =
            editing === 'new' || editing === null
              ? -1
              : instances.findIndex((item) => item.id === editing.id)
          editorMutation.mutate(
            index < 0
              ? [...instances, instance]
              : instances.map((item, itemIndex) =>
                  itemIndex === index ? instance : item
                )
          )
        }}
      />
      <RequestPluginDryRunDialog
        open={dryRunOpen}
        onOpenChange={setDryRunOpen}
        instances={instances}
        plugins={plugins}
        groups={groups}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !listMutation.isPending) setDeleteTarget(null)
        }}
        title={t('Delete instance?')}
        desc={t(
          '{{name}} stops processing requests, including on channels that added it.',
          { name: deleteTarget?.name }
        )}
        destructive
        isLoading={listMutation.isPending}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (!deleteTarget) return
          listMutation.mutate(
            instances.filter((instance) => instance.id !== deleteTarget.id)
          )
        }}
      />
    </>
  )
}
