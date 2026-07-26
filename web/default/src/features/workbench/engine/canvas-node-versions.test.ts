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
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import { removeCanvasNodes } from './canvas-domain'
import {
  createNodeVariant,
  setPrimaryNodeVersion,
} from './canvas-node-versions'

const source: CanvasNodeData = {
  id: 'image',
  type: CanvasNodeType.Image,
  title: 'Image',
  position: { x: 0, y: 0 },
  width: 300,
  height: 200,
  metadata: {
    prompt: 'cat',
    model: 'image-model',
    content: '/private',
    assetId: 7,
    taskId: 'task',
    status: 'error',
    errorDetails: 'failed',
  },
}

describe('canvas node versions', () => {
  it('creates a clean parameter variant and copies only incoming connections', () => {
    const result = createNodeVariant(
      [source],
      [
        { id: 'in', fromNodeId: 'prompt', toNodeId: 'image' },
        { id: 'out', fromNodeId: 'image', toNodeId: 'next' },
      ],
      'image'
    )
    if (!result) throw new Error('variant was not created')
    expect(result.node.metadata).toMatchObject({
      prompt: 'cat',
      model: 'image-model',
      versionLabel: 'B',
      versionRootId: 'image',
      status: 'idle',
    })
    expect(result.node.metadata?.content).toBeUndefined()
    expect(result.node.metadata?.taskId).toBeUndefined()
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0]).toMatchObject({
      fromNodeId: 'prompt',
      toNodeId: result.node.id,
    })
    expect(result.updatedNodes[0].metadata).toMatchObject({
      versionLabel: 'A',
      versionPrimary: true,
    })
  })

  it('sets exactly one primary version', () => {
    const variant = createNodeVariant([source], [], 'image')
    if (!variant) throw new Error('variant was not created')
    const nodes = setPrimaryNodeVersion(
      [...variant.updatedNodes, variant.node],
      variant.node.id
    )
    expect(nodes.filter((node) => node.metadata?.versionPrimary)).toHaveLength(
      1
    )
    expect(nodes.find((node) => node.metadata?.versionPrimary)?.id).toBe(
      variant.node.id
    )
  })

  it('detaches a variant from batch ownership so deleting it keeps original children', () => {
    const batchSource: CanvasNodeData = {
      ...source,
      metadata: {
        ...source.metadata,
        isBatchRoot: true,
        batchChildIds: ['batch-child'],
        primaryImageId: 'batch-child',
      },
    }
    const variant = createNodeVariant([batchSource], [], batchSource.id)
    if (!variant) throw new Error('variant was not created')
    expect(variant.node.metadata?.isBatchRoot).toBeUndefined()
    expect(variant.node.metadata?.batchChildIds).toBeUndefined()
    const child: CanvasNodeData = {
      ...source,
      id: 'batch-child',
      metadata: { batchRootId: batchSource.id },
    }
    const afterDelete = removeCanvasNodes(
      [batchSource, child, variant.node],
      new Set([variant.node.id])
    )
    expect(afterDelete.nodes.map((node) => node.id)).toEqual([
      batchSource.id,
      child.id,
    ])
  })
})
