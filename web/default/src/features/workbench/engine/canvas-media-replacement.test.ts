/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import { metadataForMediaReplacement } from './canvas-media-replacement'

describe('media replacement metadata', () => {
  it('keeps structural identity while removing stale media and task state', () => {
    const node: CanvasNodeData = {
      id: 'image-1',
      type: CanvasNodeType.Image,
      title: 'Original',
      position: { x: 10, y: 20 },
      width: 640,
      height: 360,
      parentId: 'frame-1',
      metadata: {
        content: '/old.png',
        assetId: 1,
        prompt: 'keep this prompt',
        model: 'image-model',
        freeResize: true,
        taskId: 'old-task',
        taskStatus: 'FAILURE',
        taskProgress: 42,
        errorDetails: 'old error',
        batchRootId: 'batch-1',
        batchChildIds: ['child-1'],
        versionRootId: 'family-1',
        versionLabel: 'B',
        versionPrimary: false,
        shotIndex: 4,
      },
    }

    const metadata = metadataForMediaReplacement(
      node,
      { id: 9, url: '/new.png' },
      'image/png'
    )

    expect(metadata).toMatchObject({
      content: '/new.png',
      assetId: 9,
      mimeType: 'image/png',
      status: 'success',
      prompt: 'keep this prompt',
      model: 'image-model',
      freeResize: true,
      batchRootId: 'batch-1',
      batchChildIds: ['child-1'],
      versionRootId: 'family-1',
      versionLabel: 'B',
      versionPrimary: false,
      shotIndex: 4,
    })
    expect(metadata).not.toHaveProperty('taskId')
    expect(metadata).not.toHaveProperty('errorDetails')
    expect(node).toMatchObject({
      id: 'image-1',
      position: { x: 10, y: 20 },
      width: 640,
      height: 360,
      parentId: 'frame-1',
    })
  })
})
