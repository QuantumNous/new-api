/* Copyright (C) 2023-2026 QuantumNous. Licensed under AGPL-3.0. */
import { describe, expect, it } from 'vitest'

import { CanvasNodeType, type CanvasNodeData } from '../types'
import { searchCanvasNodes } from './canvas-search'

const base = { position: { x: 0, y: 0 }, width: 1, height: 1 }
describe('searchCanvasNodes', () => {
  it('matches title, prompt, content and type case-insensitively with all terms', () => {
    const nodes: CanvasNodeData[] = [
      {
        ...base,
        id: '1',
        type: CanvasNodeType.Image,
        title: 'Hero',
        metadata: { prompt: 'Blue ocean' },
      },
      {
        ...base,
        id: '2',
        type: CanvasNodeType.Text,
        title: 'Notes',
        metadata: { content: 'Ocean plan' },
      },
    ]
    expect(
      searchCanvasNodes(nodes, 'hero BLUE').map((node) => node.id)
    ).toEqual(['1'])
    expect(
      searchCanvasNodes(nodes, 'text ocean').map((node) => node.id)
    ).toEqual(['2'])
  })
})
