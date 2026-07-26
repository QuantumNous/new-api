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
Adapted and substantially modified from ddcat-ai/open-ai-canvas
web/src/lib/canvas/canvas-live-viewport.ts at commit
431b9e329460e44fb6e5406ea20e9863efc56ee1 (AGPL-3.0).
See NOTICE in this directory.
*/
import type { CanvasViewport } from './types'

export function applyLiveViewport(
  container: HTMLDivElement | null,
  viewport: CanvasViewport
) {
  if (!container) return
  const gridSize = 48 * viewport.k
  container.style.setProperty('--canvas-live-x', `${viewport.x}px`)
  container.style.setProperty('--canvas-live-y', `${viewport.y}px`)
  container.style.setProperty('--canvas-live-scale', String(viewport.k))
  container.style.setProperty('--canvas-grid-size', `${gridSize}px`)
  container.style.setProperty('--canvas-grid-x', `${viewport.x % gridSize}px`)
  container.style.setProperty('--canvas-grid-y', `${viewport.y % gridSize}px`)
}
