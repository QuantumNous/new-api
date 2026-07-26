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
  type CanvasConnection,
  type CanvasNodeData,
  type CanvasNodeMetadata,
} from '../types'
import { buildNodeGenerationContext } from './canvas-generation-context'

function node(
  id: string,
  type: CanvasNodeType,
  metadata: CanvasNodeMetadata = {}
): CanvasNodeData {
  return {
    id,
    type,
    title: id,
    position: { x: 0, y: 0 },
    width: 200,
    height: 200,
    metadata,
  }
}

const link = (fromNodeId: string, toNodeId: string): CanvasConnection => ({
  id: `${fromNodeId}->${toNodeId}`,
  fromNodeId,
  toNodeId,
})

describe('buildNodeGenerationContext', () => {
  const nodes = [
    node('target', CanvasNodeType.Video),
    node('text-1', CanvasNodeType.Text, { content: 'a cold morning' }),
    node('text-2', CanvasNodeType.Text, { content: '  ' }),
    node('image-1', CanvasNodeType.Image, { content: 'https://a/first.png' }),
    node('image-2', CanvasNodeType.Image, { content: 'https://a/last.png' }),
    node('audio-1', CanvasNodeType.Audio, { content: 'https://a/voice.mp3' }),
    node('config-1', CanvasNodeType.Config, { model: 'preset-model' }),
  ]
  const connections = [
    link('text-1', 'target'),
    link('text-2', 'target'),
    link('image-1', 'target'),
    link('image-2', 'target'),
    link('audio-1', 'target'),
    link('config-1', 'target'),
  ]

  it('appends upstream text to the node prompt and collects media references', () => {
    const context = buildNodeGenerationContext(
      'target',
      nodes,
      connections,
      'pan across the city'
    )
    expect(context.prompt).toBe('pan across the city\n\na cold morning')
    expect(context.referenceImages).toEqual([
      'https://a/first.png',
      'https://a/last.png',
    ])
    expect(context.referenceAudios).toEqual(['https://a/voice.mp3'])
    expect(context.presetNodeId).toBe('config-1')
    expect(context.imageCount).toBe(2)
    expect(context.textCount).toBe(1)
  })

  it('falls back to upstream text when the node has no prompt', () => {
    const context = buildNodeGenerationContext('target', nodes, connections, '')
    expect(context.prompt).toBe('a cold morning')
  })

  it('ignores downstream and unrelated nodes', () => {
    const context = buildNodeGenerationContext(
      'text-1',
      nodes,
      connections,
      'hello'
    )
    expect(context.prompt).toBe('hello')
    expect(context.referenceImages).toEqual([])
    expect(context.presetNodeId).toBeUndefined()
  })
})
