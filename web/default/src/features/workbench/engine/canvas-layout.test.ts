/* Copyright (C) 2023-2026 QuantumNous. Licensed under AGPL-3.0. */
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import { layoutCanvasNodes } from './canvas-layout'

const node = (
  id: string,
  x: number,
  parentId?: string,
  locked = false
): CanvasNodeData => ({
  id,
  type: CanvasNodeType.Text,
  title: id,
  position: { x, y: x },
  width: 100,
  height: 50,
  parentId,
  metadata: { locked },
})
describe('layoutCanvasNodes', () => {
  it('aligns movable roots and ignores locked nodes and selected frame children', () => {
    const result = layoutCanvasNodes(
      [
        node('frame', 20),
        node('child', 40, 'frame'),
        node('other', 100),
        node('locked', 200, undefined, true),
      ],
      [],
      ['frame', 'child', 'other', 'locked'],
      'align-left'
    )
    expect(result).toEqual([
      { id: 'frame', position: { x: 20, y: 20 } },
      { id: 'other', position: { x: 20, y: 100 } },
    ])
  })
  it('orders connected nodes from left to right', () => {
    const result = layoutCanvasNodes(
      [node('b', 0), node('a', 0)],
      [{ id: 'e', fromNodeId: 'a', toNodeId: 'b' }],
      ['a', 'b'],
      'connections'
    )
    expect(result.find((item) => item.id === 'a')?.position.x).toBeLessThan(
      result.find((item) => item.id === 'b')?.position.x ?? 0
    )
  })
})
