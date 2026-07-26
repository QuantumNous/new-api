/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import {
  CanvasNodeType,
  type CanvasNodeData,
  type CanvasNodeMetadata,
} from '../types'
import {
  attachNodeToStoryboardRow,
  createStoryboardRow,
  isHiddenBatchChild,
  normalizeConnection,
  removeCanvasNodes,
} from './canvas-domain'
import { metadataForMediaReplacement } from './canvas-media-replacement'

function node(
  id: string,
  type: CanvasNodeType,
  metadata: CanvasNodeMetadata = {},
  extra: Partial<CanvasNodeData> = {}
): CanvasNodeData {
  return {
    id,
    type,
    title: id,
    position: { x: 0, y: 0 },
    width: 200,
    height: 200,
    metadata,
    ...extra,
  }
}

describe('normalizeConnection', () => {
  const nodes = [
    node('text-1', CanvasNodeType.Text),
    node('image-1', CanvasNodeType.Image),
    node('config-1', CanvasNodeType.Config),
    node('config-2', CanvasNodeType.Config),
    node('frame-1', CanvasNodeType.Frame),
  ]

  it('keeps the drag direction when starting from a source handle', () => {
    expect(normalizeConnection('text-1', 'image-1', nodes, 'source')).toEqual({
      fromNodeId: 'text-1',
      toNodeId: 'image-1',
    })
  })

  it('flips the direction when the drag started from a target handle', () => {
    expect(normalizeConnection('image-1', 'text-1', nodes, 'target')).toEqual({
      fromNodeId: 'text-1',
      toNodeId: 'image-1',
    })
  })

  it('always points config presets into the generation node', () => {
    expect(normalizeConnection('image-1', 'config-1', nodes, 'target')).toEqual(
      {
        fromNodeId: 'image-1',
        toNodeId: 'config-1',
      }
    )
    expect(normalizeConnection('config-1', 'image-1', nodes, 'source')).toEqual(
      {
        fromNodeId: 'config-1',
        toNodeId: 'image-1',
      }
    )
  })

  it('rejects self, frame and config-to-config links', () => {
    expect(normalizeConnection('text-1', 'text-1', nodes, 'source')).toBeNull()
    expect(normalizeConnection('frame-1', 'text-1', nodes, 'source')).toBeNull()
    expect(
      normalizeConnection('config-1', 'config-2', nodes, 'source')
    ).toBeNull()
  })
})

describe('attachNodeToStoryboardRow', () => {
  const row = createStoryboardRow(1)
  const script = node('script-1', CanvasNodeType.Script, {
    storyboard: { rows: [row], referenceNodeIds: [] },
  })

  it('records the generated image on the row it came from', () => {
    const nodes = [script, node('image-1', CanvasNodeType.Image)]
    const next = attachNodeToStoryboardRow(nodes, {
      fromNodeId: 'script-1',
      toNodeId: 'image-1',
      fromHandleId: `row:${row.id}`,
    })
    expect(next[0].metadata?.storyboard?.rows[0].imageNodeId).toBe('image-1')
  })

  it('records upstream media as a row reference', () => {
    const nodes = [script, node('image-9', CanvasNodeType.Image)]
    const next = attachNodeToStoryboardRow(nodes, {
      fromNodeId: 'image-9',
      toNodeId: 'script-1',
      toHandleId: `row:${row.id}`,
    })
    expect(next[0].metadata?.storyboard?.rows[0].referenceNodeIds).toEqual([
      'image-9',
    ])
  })
})

describe('removeCanvasNodes', () => {
  it('removes batch children together with their root', () => {
    const nodes = [
      node('image-root', CanvasNodeType.Image, {
        isBatchRoot: true,
        batchChildIds: ['image-child'],
      }),
      node('image-child', CanvasNodeType.Image, { batchRootId: 'image-root' }),
    ]
    const result = removeCanvasNodes(nodes, new Set(['image-root']))
    expect(result.nodes).toEqual([])
    expect([...result.removedIds].sort()).toEqual(['image-child', 'image-root'])
  })

  it('clears storyboard links pointing at deleted nodes', () => {
    const row = createStoryboardRow(1, {
      imageNodeId: 'image-1',
      referenceNodeIds: ['image-1'],
    })
    const nodes = [
      node('script-1', CanvasNodeType.Script, {
        storyboard: { rows: [row], referenceNodeIds: ['image-1'] },
      }),
      node('image-1', CanvasNodeType.Image),
    ]
    const result = removeCanvasNodes(nodes, new Set(['image-1']))
    const storyboard = result.nodes[0].metadata?.storyboard
    expect(storyboard?.referenceNodeIds).toEqual([])
    expect(storyboard?.rows[0].imageNodeId).toBeUndefined()
    expect(storyboard?.rows[0].referenceNodeIds).toEqual([])
  })

  it('detaches children of a deleted frame', () => {
    const nodes = [
      node('frame-1', CanvasNodeType.Frame),
      node('text-1', CanvasNodeType.Text, {}, { parentId: 'frame-1' }),
    ]
    const result = removeCanvasNodes(nodes, new Set(['frame-1']))
    expect(result.nodes[0].parentId).toBeUndefined()
  })

  it('keeps batch visibility and delete ownership after root and child replacement', () => {
    const root = node('root', CanvasNodeType.Image, {
      isBatchRoot: true,
      batchChildIds: ['child'],
      primaryImageId: 'child',
    })
    const child = node('child', CanvasNodeType.Image, { batchRootId: 'root' })
    root.metadata = metadataForMediaReplacement(
      root,
      { id: 1, url: '/root.png' },
      'image/png'
    )
    child.metadata = metadataForMediaReplacement(
      child,
      { id: 2, url: '/child.png' },
      'image/png'
    )
    expect(isHiddenBatchChild(child, [root, child])).toBe(true)
    expect(removeCanvasNodes([root, child], new Set([root.id])).nodes).toEqual(
      []
    )
  })
})

describe('isHiddenBatchChild', () => {
  it('hides children while their root is collapsed', () => {
    const nodes = [
      node('root', CanvasNodeType.Image, {
        isBatchRoot: true,
        batchChildIds: ['child'],
      }),
      node('child', CanvasNodeType.Image, { batchRootId: 'root' }),
    ]
    expect(isHiddenBatchChild(nodes[1], nodes)).toBe(true)
    nodes[0].metadata = { ...nodes[0].metadata, imageBatchExpanded: true }
    expect(isHiddenBatchChild(nodes[1], nodes)).toBe(false)
  })
})
