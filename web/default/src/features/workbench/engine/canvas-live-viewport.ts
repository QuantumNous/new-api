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
import type { ViewportTransform } from '../types'

export const CANVAS_VIEWPORT_PREVIEW_EVENT = 'canvas:viewport-preview'

export function applyCanvasLiveViewport(
  container: HTMLDivElement | null,
  viewport: ViewportTransform,
  notify = true
) {
  if (!container) return
  const gridSize = 48 * viewport.k
  container.style.setProperty('--canvas-live-x', `${viewport.x}px`)
  container.style.setProperty('--canvas-live-y', `${viewport.y}px`)
  container.style.setProperty('--canvas-live-scale', String(viewport.k))
  container.style.setProperty('--canvas-grid-size', `${gridSize}px`)
  container.style.setProperty('--canvas-grid-x', `${viewport.x % gridSize}px`)
  container.style.setProperty('--canvas-grid-y', `${viewport.y % gridSize}px`)
  container.style.setProperty(
    '--canvas-dot-size',
    viewport.k < 0.12 ? '0.8px' : '1.15px'
  )
  if (notify) {
    container.dispatchEvent(
      new CustomEvent<ViewportTransform>(CANVAS_VIEWPORT_PREVIEW_EVENT, {
        detail: viewport,
      })
    )
  }
}

export function subscribeCanvasViewportPreview(
  container: HTMLDivElement,
  listener: (viewport: ViewportTransform) => void
) {
  const handlePreview = (event: Event) =>
    listener((event as CustomEvent<ViewportTransform>).detail)
  container.addEventListener(CANVAS_VIEWPORT_PREVIEW_EVENT, handlePreview)
  return () =>
    container.removeEventListener(CANVAS_VIEWPORT_PREVIEW_EVENT, handlePreview)
}
