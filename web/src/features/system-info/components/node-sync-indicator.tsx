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
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { useNodeSync } from '../hooks/use-node-sync'
import {
  nodeSyncState,
  registeredSyncTopics,
  syncTopicLabel,
  type NodeSyncState,
} from '../lib/node-sync'

const STATE_TEXT_CLASS_NAME: Record<NodeSyncState, string> = {
  synced: 'text-muted-foreground',
  updating: 'text-muted-foreground',
  failed:
    'text-destructive hover:text-destructive aria-expanded:text-destructive',
}

function NodeSyncStateIcon(props: { state: NodeSyncState }) {
  if (props.state === 'failed') {
    return <CircleAlert data-icon='inline-start' aria-hidden='true' />
  }
  if (props.state === 'updating') {
    return (
      <Spinner
        data-icon='inline-start'
        className='size-3.5'
        aria-hidden='true'
      />
    )
  }
  return (
    <CircleCheck
      data-icon='inline-start'
      className='text-emerald-600 dark:text-emerald-400'
      aria-hidden='true'
    />
  )
}

type NodeSyncIndicatorProps = {
  /** The sync topics the changes on this page go through. */
  topics: string[]
  /** Plugin display names by key, for plugins that failed to load. */
  pluginNames?: Record<string, string>
}

/**
 * Whether the changes on a page have reached every online node. Shown only
 * with two or more online nodes; a click lists each node.
 */
export function NodeSyncIndicator(props: NodeSyncIndicatorProps) {
  const { t } = useTranslation()
  const syncQuery = useNodeSync(props.topics)
  const sync = syncQuery.data
  if (!sync) return null
  const topics = registeredSyncTopics(sync, props.topics)
  const nodes = sync.nodes.filter((node) => node.online)
  if (topics.length === 0 || nodes.length < 2) return null

  const states = nodes.map((node) => nodeSyncState(node, topics))
  const failedCount = states.filter((state) => state === 'failed').length
  const syncedCount = states.filter((state) => state === 'synced').length
  let summary: NodeSyncState = 'synced'
  let summaryText = t('Up to date on {{count}} nodes', { count: nodes.length })
  if (failedCount > 0) {
    summary = 'failed'
    summaryText = t('Failed on {{count}} nodes', { count: failedCount })
  } else if (syncedCount < nodes.length) {
    summary = 'updating'
    summaryText = t('{{synced}}/{{total}} nodes updated', {
      synced: syncedCount,
      total: nodes.length,
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='sm'
            className={cn('font-normal', STATE_TEXT_CLASS_NAME[summary])}
          />
        }
      >
        <NodeSyncStateIcon state={summary} />
        {summaryText}
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80'>
        <PopoverHeader>
          <PopoverTitle>{t('Nodes')}</PopoverTitle>
        </PopoverHeader>
        <ul className='max-h-80 divide-y overflow-y-auto'>
          {nodes.map((node, index) => {
            const state = states[index]
            let stateText = t('In effect')
            if (state === 'failed') stateText = t('Update failed')
            else if (state === 'updating') stateText = t('Updating')
            const problems = topics.flatMap((topic) => {
              const entry = node.topics[topic]
              if (!entry || state !== 'failed') return []
              const items = Object.entries(entry.errors).map(
                ([key, message]) => ({
                  key: `${topic}:${key}`,
                  label:
                    topic === 'plugins'
                      ? (props.pluginNames?.[key] ?? key)
                      : key,
                  message,
                })
              )
              if (entry.error) {
                items.unshift({
                  key: topic,
                  label: syncTopicLabel(topic, t),
                  message: entry.error,
                })
              }
              return items
            })
            return (
              <li key={node.node_name} className='space-y-1.5 py-2 last:pb-0'>
                <div className='flex items-center justify-between gap-3'>
                  <span className='min-w-0 truncate font-medium'>
                    {node.node_name}
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 text-xs [&>svg]:size-3.5',
                      STATE_TEXT_CLASS_NAME[state]
                    )}
                  >
                    <NodeSyncStateIcon state={state} />
                    {stateText}
                  </span>
                </div>
                {problems.length > 0 && (
                  <ul className='space-y-1 text-xs'>
                    {problems.map((problem) => (
                      <li
                        key={problem.key}
                        className='bg-destructive/5 rounded-md px-2 py-1.5'
                      >
                        <div className='font-medium'>{problem.label}</div>
                        <div className='text-muted-foreground break-words'>
                          {problem.message}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
