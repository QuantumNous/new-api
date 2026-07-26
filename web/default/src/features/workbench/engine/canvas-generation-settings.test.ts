/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { resolveGenerationSettings } from '../hooks/use-canvas-generation'
import { CanvasNodeType, type CanvasNodeData } from '../types'

const node = (
  id: string,
  metadata: CanvasNodeData['metadata']
): CanvasNodeData => ({
  id,
  title: id,
  type: CanvasNodeType.Audio,
  position: { x: 0, y: 0 },
  width: 1,
  height: 1,
  metadata,
})

describe('resolveGenerationSettings', () => {
  it('keeps explicit zero-like values and lets node settings override presets', () => {
    const preset = node('preset', {
      model: 'preset',
      count: 2,
      audioSpeed: '1.5',
    })
    const target = node('target', {
      model: 'node',
      count: 0,
      audioSpeed: '0',
      audioInstructions: '',
    })
    expect(
      resolveGenerationSettings(target, [preset, target], 'preset')
    ).toMatchObject({ model: 'node', count: 0, audioSpeed: '0' })
  })
})
