/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type {
  StoryboardBatch,
  StoryboardBatchItemStatus,
  StoryboardRow,
} from '../types'

export function createStoryboardBatch(
  id: string,
  kind: StoryboardBatch['kind'],
  rows: StoryboardRow[]
): StoryboardBatch {
  return {
    id,
    kind,
    stopped: false,
    items: rows.map((row) => ({ rowId: row.id, status: 'waiting' })),
  }
}

export function claimStoryboardBatchItems(
  batch: StoryboardBatch,
  concurrency: number
): { batch: StoryboardBatch; rowIds: string[] } {
  if (batch.stopped) return { batch, rowIds: [] }
  const slots = Math.max(
    0,
    concurrency - batch.items.filter((item) => item.status === 'running').length
  )
  const rowIds = batch.items
    .filter((item) => item.status === 'waiting')
    .slice(0, slots)
    .map((item) => item.rowId)
  const claimed = new Set(rowIds)
  return {
    batch: {
      ...batch,
      items: batch.items.map((item) =>
        claimed.has(item.rowId)
          ? { ...item, status: 'running', errorDetails: undefined }
          : item
      ),
    },
    rowIds,
  }
}

export function setStoryboardBatchItemStatus(
  batch: StoryboardBatch,
  rowId: string,
  status: StoryboardBatchItemStatus,
  errorDetails?: string
): StoryboardBatch {
  return {
    ...batch,
    items: batch.items.map((item) =>
      item.rowId === rowId ? { ...item, status, errorDetails } : item
    ),
  }
}

export function stopStoryboardBatch(batch: StoryboardBatch): StoryboardBatch {
  return {
    ...batch,
    stopped: true,
    items: batch.items.map((item) =>
      item.status === 'waiting' ? { ...item, status: 'cancelled' } : item
    ),
  }
}

export function retryStoryboardBatchItem(
  batch: StoryboardBatch,
  rowId: string
): StoryboardBatch {
  return {
    ...batch,
    stopped: false,
    items: batch.items.map((item) =>
      item.rowId === rowId &&
      (item.status === 'failed' || item.status === 'cancelled')
        ? { ...item, status: 'waiting', errorDetails: undefined }
        : item
    ),
  }
}

export function reconcileStoryboardBatchItem(
  batch: StoryboardBatch,
  rowId: string,
  generatedStatus: 'idle' | 'loading' | 'success' | 'error' | 'missing',
  hasRecoverableTask: boolean,
  interruptedError: string
): StoryboardBatch {
  const item = batch.items.find((candidate) => candidate.rowId === rowId)
  if (item?.status !== 'running') return batch
  if (generatedStatus === 'success') {
    return setStoryboardBatchItemStatus(batch, rowId, 'succeeded')
  }
  if (generatedStatus === 'error') {
    return setStoryboardBatchItemStatus(
      batch,
      rowId,
      'failed',
      interruptedError
    )
  }
  if (hasRecoverableTask) return batch
  return setStoryboardBatchItemStatus(batch, rowId, 'failed', interruptedError)
}
