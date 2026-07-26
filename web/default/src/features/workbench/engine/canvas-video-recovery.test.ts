/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import { shouldRecoverCanvasVideoTask } from './canvas-video-recovery'

const pendingNode = {
  id: 'video-1',
  type: CanvasNodeType.Video,
  metadata: { taskId: 'task-1', taskStatus: 'RUNNING' },
} as CanvasNodeData

describe('canvas video task recovery', () => {
  it('recovers persisted unfinished tasks but not terminal tasks', () => {
    expect(
      shouldRecoverCanvasVideoTask(pendingNode, new Set(), new Set())
    ).toBe(true)
    expect(
      shouldRecoverCanvasVideoTask(
        {
          ...pendingNode,
          metadata: { ...pendingNode.metadata, taskStatus: 'SUCCESS' },
        },
        new Set(),
        new Set()
      )
    ).toBe(false)
  })

  it('prevents duplicate observers and respects a local observation stop', () => {
    expect(
      shouldRecoverCanvasVideoTask(pendingNode, new Set(['video-1']), new Set())
    ).toBe(false)
    expect(
      shouldRecoverCanvasVideoTask(pendingNode, new Set(), new Set(['video-1']))
    ).toBe(false)
  })
})
