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
import type { PlaygroundRecordPayload } from '../types'

const DATABASE_NAME = 'new-api-playground'
const DATABASE_VERSION = 1
const STORE_NAME = 'pending-records'
const USER_INDEX = 'user-id'

interface StoredPendingRecord {
  key: string
  userId: number
  payload: PlaygroundRecordPayload
}

export interface PendingRecordStore {
  put(userId: number, payload: PlaygroundRecordPayload): Promise<void>
  list(userId: number): Promise<PlaygroundRecordPayload[]>
  remove(userId: number, recordIds: string[]): Promise<void>
  clear(userId: number): Promise<void>
}

export interface PlaygroundOutbox {
  enqueue(
    userId: number,
    payload: PlaygroundRecordPayload
  ): Promise<'persistent' | 'volatile'>
  list(userId: number): Promise<PlaygroundRecordPayload[]>
  remove(userId: number, recordIds: string[]): Promise<void>
  clear(userId: number): Promise<void>
}

function recordKey(userId: number, recordId: string): string {
  return `${userId}:${recordId}`
}

function sortRecords(
  records: PlaygroundRecordPayload[]
): PlaygroundRecordPayload[] {
  return records.sort(
    (left, right) =>
      left.client_completed_at - right.client_completed_at ||
      left.record_id.localeCompare(right.record_id)
  )
}

export function createMemoryPendingRecordStore(): PendingRecordStore {
  const records = new Map<string, StoredPendingRecord>()

  return {
    async put(userId, payload) {
      records.set(recordKey(userId, payload.record_id), {
        key: recordKey(userId, payload.record_id),
        userId,
        payload,
      })
    },
    async list(userId) {
      return sortRecords(
        Array.from(records.values())
          .filter((record) => record.userId === userId)
          .map((record) => record.payload)
      )
    },
    async remove(userId, recordIds) {
      recordIds.forEach((recordId) =>
        records.delete(recordKey(userId, recordId))
      )
    },
    async clear(userId) {
      Array.from(records.values()).forEach((record) => {
        if (record.userId === userId) records.delete(record.key)
      })
    },
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error || new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error || new Error('IndexedDB transaction aborted'))
    transaction.onerror = () =>
      reject(transaction.error || new Error('IndexedDB transaction failed'))
  })
}

export function createIndexedDbPendingRecordStore(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined'
    ? undefined
    : indexedDB
): PendingRecordStore | null {
  if (!factory) return null

  let databasePromise: Promise<IDBDatabase> | null = null
  const openDatabase = () => {
    if (databasePromise) return databasePromise
    databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        const store = database.objectStoreNames.contains(STORE_NAME)
          ? request.transaction?.objectStore(STORE_NAME)
          : database.createObjectStore(STORE_NAME, { keyPath: 'key' })
        if (store && !store.indexNames.contains(USER_INDEX)) {
          store.createIndex(USER_INDEX, 'userId', { unique: false })
        }
      }
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
      request.onerror = () => {
        databasePromise = null
        reject(request.error || new Error('Failed to open Playground outbox'))
      }
      request.onblocked = () => {
        databasePromise = null
        reject(new Error('Playground outbox upgrade was blocked'))
      }
    })
    return databasePromise
  }

  return {
    async put(userId, payload) {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const request = transaction.objectStore(STORE_NAME).put({
        key: recordKey(userId, payload.record_id),
        userId,
        payload,
      } satisfies StoredPendingRecord)
      await Promise.all([requestResult(request), transactionDone(transaction)])
    },
    async list(userId) {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction
        .objectStore(STORE_NAME)
        .index(USER_INDEX)
        .getAll(userId)
      const [records] = await Promise.all([
        requestResult(request) as Promise<StoredPendingRecord[]>,
        transactionDone(transaction),
      ])
      return sortRecords(records.map((record) => record.payload))
    },
    async remove(userId, recordIds) {
      if (recordIds.length === 0) return
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const requests = recordIds.map((recordId) =>
        requestResult(store.delete(recordKey(userId, recordId)))
      )
      await Promise.all([...requests, transactionDone(transaction)])
    },
    async clear(userId) {
      const records = await this.list(userId)
      await this.remove(
        userId,
        records.map((record) => record.record_id)
      )
    },
  }
}

export function createPlaygroundOutbox(
  primary: PendingRecordStore | null,
  volatile: PendingRecordStore = createMemoryPendingRecordStore()
): PlaygroundOutbox {
  return {
    async enqueue(userId, payload) {
      if (primary) {
        try {
          await primary.put(userId, payload)
          await volatile.remove(userId, [payload.record_id])
          return 'persistent'
        } catch {
          // The volatile queue keeps the record retryable for this page lifetime.
        }
      }
      await volatile.put(userId, payload)
      return 'volatile'
    },
    async list(userId) {
      const persistent = primary ? await primary.list(userId) : []
      const inMemory = await volatile.list(userId)
      const merged = new Map<string, PlaygroundRecordPayload>()
      persistent.forEach((record) => merged.set(record.record_id, record))
      inMemory.forEach((record) => merged.set(record.record_id, record))
      return sortRecords(Array.from(merged.values()))
    },
    async remove(userId, recordIds) {
      await Promise.allSettled([
        primary?.remove(userId, recordIds),
        volatile.remove(userId, recordIds),
      ])
    },
    async clear(userId) {
      await Promise.allSettled([primary?.clear(userId), volatile.clear(userId)])
    },
  }
}

export const browserPlaygroundOutbox = createPlaygroundOutbox(
  createIndexedDbPendingRecordStore()
)
