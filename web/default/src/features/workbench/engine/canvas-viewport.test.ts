/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { CANVAS_MAX_SCALE, CANVAS_MIN_SCALE } from '../constants'
import { CanvasNodeType, type CanvasNodeData } from '../types'
import {
  clampCanvasScale,
  fitNodeSize,
  getCanvasNodesBounds,
  nodeSizeFromRatio,
  viewportAtScale,
  viewportForBounds,
} from './canvas-viewport'

function node(x: number, y: number, width = 100, height = 100): CanvasNodeData {
  return {
    id: `${x}-${y}`,
    type: CanvasNodeType.Text,
    title: 'node',
    position: { x, y },
    width,
    height,
  }
}

describe('clampCanvasScale', () => {
  it('keeps the scale inside the supported zoom range', () => {
    expect(clampCanvasScale(0)).toBe(CANVAS_MIN_SCALE)
    expect(clampCanvasScale(1000)).toBe(CANVAS_MAX_SCALE)
    expect(clampCanvasScale(1)).toBe(1)
  })
})

describe('getCanvasNodesBounds', () => {
  it('returns null without nodes', () => {
    expect(getCanvasNodesBounds([])).toBeNull()
  })

  it('covers every node box', () => {
    expect(getCanvasNodesBounds([node(0, 0), node(200, 50)])).toEqual({
      left: 0,
      top: 0,
      right: 300,
      bottom: 150,
    })
  })
})

describe('viewportForBounds', () => {
  it('centers the bounds and never zooms past 1x', () => {
    const viewport = viewportForBounds(
      { left: 0, top: 0, right: 100, bottom: 100 },
      { width: 1000, height: 1000 },
      { padding: 0 }
    )
    expect(viewport.k).toBe(1)
    expect(viewport.x).toBe(450)
    expect(viewport.y).toBe(450)
  })

  it('shrinks to fit oversized content', () => {
    const viewport = viewportForBounds(
      { left: 0, top: 0, right: 2000, bottom: 1000 },
      { width: 1000, height: 1000 },
      { padding: 0 }
    )
    expect(viewport.k).toBeCloseTo(0.5)
  })
})

describe('viewportAtScale', () => {
  it('keeps the world point under the viewport center', () => {
    const next = viewportAtScale(
      { x: 0, y: 0, k: 1 },
      { width: 800, height: 600 },
      2
    )
    expect(next.k).toBe(2)
    expect(next.x).toBe(-400)
    expect(next.y).toBe(-300)
  })
})

describe('nodeSizeFromRatio', () => {
  it('parses both ratio notations', () => {
    expect(nodeSizeFromRatio('1024x1024', 400, 400)).toEqual({
      width: 400,
      height: 400,
    })
    expect(nodeSizeFromRatio('16:9', 400, 400)).toEqual({
      width: 400,
      height: 225,
    })
  })

  it('ignores unparsable sizes', () => {
    expect(nodeSizeFromRatio('auto', 400, 400)).toBeNull()
  })
})

describe('fitNodeSize', () => {
  it('scales down while preserving the aspect ratio', () => {
    expect(fitNodeSize(1280, 640, 640, 640)).toEqual({
      width: 640,
      height: 320,
    })
  })

  it('leaves smaller media untouched', () => {
    expect(fitNodeSize(320, 200, 640, 640)).toEqual({ width: 320, height: 200 })
  })
})
