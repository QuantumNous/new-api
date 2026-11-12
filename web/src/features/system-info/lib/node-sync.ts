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
import type { TFunction } from 'i18next'

import type { NodeSync, NodeSyncNode } from '../types'

export const NODE_SYNC_QUERY_KEY = ['node-sync']

/** Labels of the sync topics the server registers; others show their id. */
const SYNC_TOPIC_LABELS: Record<string, string> = {
  options: 'Settings',
  channels: 'Channels',
  authz: 'Permissions',
  plugins: 'Plugins',
  oauth_providers: 'Login providers',
  models: 'Models',
  subscription_plans: 'Subscription Plans',
}

export type NodeSyncState = 'synced' | 'updating' | 'failed'

export function syncTopicLabel(topic: string, t: TFunction) {
  const label = SYNC_TOPIC_LABELS[topic]
  return label ? t(label) : topic
}

/**
 * The watched topics the server registers, all of them without a watch list.
 * A topic the server does not run (the channel cache when it is off) has no
 * state on any node.
 */
export function registeredSyncTopics(sync: NodeSync, topics?: string[]) {
  const registered = sync.topics.map((item) => item.topic)
  if (!topics) return registered
  return topics.filter((topic) => registered.includes(topic))
}

/** A node fails on any load error, else updates until every topic is synced. */
export function nodeSyncState(
  node: NodeSyncNode,
  topics: string[]
): NodeSyncState {
  let state: NodeSyncState = 'synced'
  for (const topic of topics) {
    const entry = node.topics[topic]
    if (entry?.error || Object.keys(entry?.errors ?? {}).length > 0) {
      return 'failed'
    }
    if (!entry?.synced) state = 'updating'
  }
  return state
}
