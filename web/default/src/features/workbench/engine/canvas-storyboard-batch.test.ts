/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import type { StoryboardRow } from '../types'
import {
  claimStoryboardBatchItems,
  createStoryboardBatch,
  reconcileStoryboardBatchItem,
  retryStoryboardBatchItem,
  setStoryboardBatchItemStatus,
  stopStoryboardBatch,
} from './canvas-storyboard-batch'

const rows = ['one', 'two', 'three'].map(
  (id, index) => ({ id, shotNumber: index + 1 }) as StoryboardRow
)

describe('storyboard batch scheduling', () => {
  it('claims only free concurrency slots and never resubmits running or successful items', () => {
    let batch = createStoryboardBatch('batch', 'video', rows)
    batch = setStoryboardBatchItemStatus(batch, 'one', 'succeeded')
    batch = setStoryboardBatchItemStatus(batch, 'two', 'running')

    const claimed = claimStoryboardBatchItems(batch, 2)

    expect(claimed.rowIds).toEqual(['three'])
    expect(claimStoryboardBatchItems(claimed.batch, 2).rowIds).toEqual([])
  })

  it('stops only unsubmitted work and allows one failed item to be retried', () => {
    let batch = createStoryboardBatch('batch', 'image', rows)
    batch = setStoryboardBatchItemStatus(batch, 'one', 'running')
    batch = setStoryboardBatchItemStatus(batch, 'two', 'failed', 'denied')
    batch = stopStoryboardBatch(batch)

    expect(batch.items.map((item) => item.status)).toEqual([
      'running',
      'failed',
      'cancelled',
    ])
    const retried = retryStoryboardBatchItem(batch, 'two')
    expect(retried.stopped).toBe(false)
    expect(retried.items[1]).toMatchObject({ status: 'waiting' })
    expect(retried.items[2]).toMatchObject({ status: 'cancelled' })
  })

  it('keeps submitted recoverable work running without submitting it again', () => {
    let batch = createStoryboardBatch('batch', 'video', rows)
    batch = setStoryboardBatchItemStatus(batch, 'one', 'running')

    const recovered = reconcileStoryboardBatchItem(
      batch,
      'one',
      'loading',
      true,
      'interrupted'
    )
    expect(recovered.items[0].status).toBe('running')
    expect(claimStoryboardBatchItems(recovered, 1).rowIds).toEqual([])
  })

  it('reconciles submitted work after pending items were stopped', () => {
    let batch = createStoryboardBatch('batch', 'video', rows)
    batch = setStoryboardBatchItemStatus(batch, 'one', 'running')
    batch = stopStoryboardBatch(batch)

    const recovered = reconcileStoryboardBatchItem(
      batch,
      'one',
      'success',
      false,
      'interrupted'
    )

    expect(recovered.stopped).toBe(true)
    expect(recovered.items.map((item) => item.status)).toEqual([
      'succeeded',
      'cancelled',
      'cancelled',
    ])
    expect(claimStoryboardBatchItems(recovered, 2).rowIds).toEqual([])
  })
})
