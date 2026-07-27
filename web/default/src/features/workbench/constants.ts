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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { CanvasNodeType, type CanvasNodeMetadata } from './types'

type CanvasNodeSpec = {
  width: number
  height: number
  title: string
  metadata?: CanvasNodeMetadata
}

export const NODE_DEFAULT_SIZE = {
  [CanvasNodeType.Image]: { width: 360, height: 400, title: 'New generation' },
  [CanvasNodeType.Text]: { width: 340, height: 240, title: 'Note' },
  [CanvasNodeType.Script]: { width: 920, height: 360, title: 'Storyboard' },
  [CanvasNodeType.Config]: {
    width: 340,
    height: 320,
    title: 'Generation preset',
  },
  [CanvasNodeType.Video]: { width: 420, height: 430, title: 'Video' },
  [CanvasNodeType.Audio]: { width: 360, height: 300, title: 'Audio' },
  [CanvasNodeType.Frame]: { width: 760, height: 520, title: 'Frame' },
} satisfies Record<
  CanvasNodeType,
  { width: number; height: number; title: string }
>

/**
 * Smallest size that still fits a node's controls. Below these values the
 * prompt bar, settings row, and media preview start colliding.
 */
export const NODE_MIN_SIZE = {
  [CanvasNodeType.Image]: { width: 300, height: 320 },
  [CanvasNodeType.Text]: { width: 200, height: 120 },
  [CanvasNodeType.Script]: { width: 520, height: 240 },
  [CanvasNodeType.Config]: { width: 260, height: 220 },
  [CanvasNodeType.Video]: { width: 320, height: 340 },
  [CanvasNodeType.Audio]: { width: 300, height: 250 },
  [CanvasNodeType.Frame]: { width: 240, height: 44 },
} satisfies Record<CanvasNodeType, { width: number; height: number }>

export function nodeMinSize(type: CanvasNodeType) {
  return NODE_MIN_SIZE[type]
}

export const NODE_SPECS = {
  [CanvasNodeType.Image]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
    metadata: { content: '', status: 'idle' },
  },
  [CanvasNodeType.Text]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
    metadata: { content: '', status: 'idle', fontSize: 14 },
  },
  [CanvasNodeType.Script]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Script],
    metadata: {
      status: 'idle',
      workflowKind: 'script',
      storyboard: { rows: [], referenceNodeIds: [] },
    },
  },
  [CanvasNodeType.Config]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
    metadata: { content: '', status: 'idle', generationMode: 'image' },
  },
  [CanvasNodeType.Video]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
    metadata: { content: '', status: 'idle' },
  },
  [CanvasNodeType.Audio]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
    metadata: { content: '', status: 'idle' },
  },
  [CanvasNodeType.Frame]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Frame],
    metadata: {
      frame: {
        collapsed: false,
        expandedWidth: NODE_DEFAULT_SIZE[CanvasNodeType.Frame].width,
        expandedHeight: NODE_DEFAULT_SIZE[CanvasNodeType.Frame].height,
      },
    },
  },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>

export function getNodeSpec(type: CanvasNodeType) {
  return NODE_SPECS[type]
}

/** Card border plus the title bar every node renders above its body. */
export const NODE_CHROME_TOP = 37
/** Body bottom padding plus the card border. */
export const NODE_CHROME_BOTTOM = 11

export const STORYBOARD_ROW_HEIGHT = 48
/**
 * Must match the rendered storyboard header exactly: row connection anchors are
 * derived from it, so a mismatch offsets every edge drawn into a shot row.
 */
export const STORYBOARD_HEADER_HEIGHT = 78
export const STORYBOARD_FOOTER_HEIGHT = 44

/** Distance from the node origin to the first storyboard row. */
export function storyboardTableTop() {
  return NODE_CHROME_TOP + STORYBOARD_HEADER_HEIGHT
}

export function storyboardTableHeight(nodeHeight: number) {
  return Math.max(
    STORYBOARD_ROW_HEIGHT,
    nodeHeight -
      storyboardTableTop() -
      STORYBOARD_FOOTER_HEIGHT -
      NODE_CHROME_BOTTOM
  )
}

export const CANVAS_MIN_SCALE = 0.05
export const CANVAS_MAX_SCALE = 2
