/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import {
  canvasMentionToken,
  insertPromptShortcut,
  mentionedNodeIds,
} from './canvas-prompt-shortcuts'

describe('canvas prompt shortcuts', () => {
  it('inserts stable mention tokens and removes the typed query', () => {
    const node = {
      id: 'asset-1',
      title: 'Hero ] image',
      type: CanvasNodeType.Image,
    } as CanvasNodeData
    const token = canvasMentionToken(node)
    expect(token).toBe('@[Hero  image](node:asset-1)')
    expect(insertPromptShortcut('use @her now', 8, 4, token)).toEqual({
      value: `use ${token} now`,
      cursor: 4 + token.length + 1,
    })
  })

  it('parses mention ids once in first-use order', () => {
    expect(mentionedNodeIds('@[A](node:a) @[A](node:a) @[B](node:b)')).toEqual([
      'a',
      'b',
    ])
  })
})
