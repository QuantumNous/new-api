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
import { describe, expect, test } from 'bun:test'
import type { PlaygroundRecordPayload } from '../types'
import {
  createIndexedDbConnectionCache,
  createMemoryPendingRecordStore,
  createPlaygroundOutbox,
  type PlaygroundOutbox,
  type PendingRecordStore,
} from './playground-outbox'

async function listRecords(
  outbox: PlaygroundOutbox,
  userId: number
): Promise<PlaygroundRecordPayload[]> {
  return (await outbox.read(userId)).records
}

function sampleRecord(
  recordId: string,
  outputText: string,
  completedAt: number
): PlaygroundRecordPayload {
  return {
    record_id: recordId,
    conversation_id: 'conversation-a',
    user_message: {
      key: `user-${recordId}`,
      from: 'user',
      versions: [{ id: 'v1', content: 'hello' }],
    },
    request_messages: [{ role: 'user', content: 'hello' }],
    assistant_message: {
      key: `assistant-${recordId}`,
      from: 'assistant',
      versions: [{ id: 'v1', content: outputText }],
      status: 'complete',
    },
    reasoning_content: '',
    input_text: 'hello',
    output_text: outputText,
    model_name: 'gpt-test',
    group_name: 'plg',
    parameters: { stream: true },
    status: 'complete',
    error_code: '',
    error_message: '',
    relay_request_id: '',
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    latency_ms: 10,
    messages_snapshot: [],
    client_completed_at: completedAt,
  }
}

describe('Playground outbox', () => {
  test('retains records enqueued concurrently without a shared array overwrite', async () => {
    const outbox = createPlaygroundOutbox(createMemoryPendingRecordStore())

    await Promise.all([
      outbox.enqueue(10, sampleRecord('record-a', 'first', 1000)),
      outbox.enqueue(10, sampleRecord('record-b', 'second', 2000)),
    ])

    expect(
      (await listRecords(outbox, 10)).map((record) => record.record_id)
    ).toEqual(['record-a', 'record-b'])
  })

  test('updates a duplicate id without changing FIFO position', async () => {
    const outbox = createPlaygroundOutbox(createMemoryPendingRecordStore())
    await outbox.enqueue(10, sampleRecord('record-a', 'draft', 1000))
    await outbox.enqueue(10, sampleRecord('record-b', 'second', 2000))
    await outbox.enqueue(10, sampleRecord('record-a', 'final', 1000))

    const pending = await listRecords(outbox, 10)

    expect(pending.map((record) => record.record_id)).toEqual([
      'record-a',
      'record-b',
    ])
    expect(pending[0]?.output_text).toBe('final')
  })

  test('retains a volatile retry when the persistent store rejects a write', async () => {
    const primary = createMemoryPendingRecordStore()
    const failingPrimary: PendingRecordStore = {
      ...primary,
      put: async () => {
        throw new Error('quota exceeded')
      },
    }
    const outbox = createPlaygroundOutbox(
      failingPrimary,
      createMemoryPendingRecordStore()
    )

    const result = await outbox.enqueue(
      10,
      sampleRecord('record-a', 'offline', 1000)
    )

    expect(result).toBe('volatile')
    expect(
      (await listRecords(outbox, 10)).map((record) => record.record_id)
    ).toEqual(['record-a'])
  })

  test('reports a durable read failure while retaining volatile retries', async () => {
    const primary = createMemoryPendingRecordStore()
    const failingPrimary: PendingRecordStore = {
      ...primary,
      list: async () => {
        throw new Error('database unavailable')
      },
    }
    const volatile = createMemoryPendingRecordStore()
    await volatile.put(10, sampleRecord('record-a', 'offline', 1000))
    const outbox = createPlaygroundOutbox(failingPrimary, volatile)

    const snapshot = await outbox.read(10)

    expect(snapshot.persistentReadFailed).toBe(true)
    expect(snapshot.records.map((record) => record.record_id)).toEqual([
      'record-a',
    ])
  })

  test('removes delivered ids without deleting a record enqueued during delivery', async () => {
    const outbox = createPlaygroundOutbox(createMemoryPendingRecordStore())
    await outbox.enqueue(10, sampleRecord('record-a', 'first', 1000))
    await outbox.enqueue(10, sampleRecord('record-b', 'second', 2000))
    const attempted = await listRecords(outbox, 10)

    await outbox.enqueue(10, sampleRecord('record-c', 'new', 3000))
    await outbox.remove(
      10,
      attempted.slice(0, 1).map((record) => record.record_id)
    )

    expect(
      (await listRecords(outbox, 10)).map((record) => record.record_id)
    ).toEqual(['record-b', 'record-c'])
  })

  test('reopens IndexedDB after a version change closes the cached connection', async () => {
    let openCount = 0
    let firstClosed = false
    const first = {
      close: () => {
        firstClosed = true
      },
      onversionchange: null,
    } as unknown as IDBDatabase
    const second = {
      close: () => undefined,
      onversionchange: null,
    } as unknown as IDBDatabase
    const getDatabase = createIndexedDbConnectionCache(async () => {
      openCount += 1
      return openCount === 1 ? first : second
    })

    expect(await getDatabase()).toBe(first)
    expect(await getDatabase()).toBe(first)
    first.onversionchange?.({} as IDBVersionChangeEvent)

    expect(firstClosed).toBe(true)
    expect(await getDatabase()).toBe(second)
    expect(openCount).toBe(2)
  })
})
