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

/**
 * Theme color → RGB helpers.
 *
 * The theme system defines colors as `oklch(...)` strings, but the browser
 * serializes a computed oklch custom property as `lab(...)` (CIE Lab D50),
 * and WebGL shaders only accept RGB floats. Rather than hand-writing a color
 * space conversion, we let a canvas 2D context rasterize the color string and
 * read the resulting pixel — the browser's own color engine does the work and
 * accepts every CSS color format the theme can emit (oklch, lab, hex, named).
 */

let probe: HTMLCanvasElement | null = null
let probeCtx: CanvasRenderingContext2D | null = null

function getProbe(): CanvasRenderingContext2D | null {
  if (probeCtx) return probeCtx
  if (typeof document === 'undefined') return null
  probe = document.createElement('canvas')
  probe.width = 1
  probe.height = 1
  probeCtx = probe.getContext('2d')
  return probeCtx
}

/**
 * Rasterize any CSS color string to `[r, g, b]` (0-255) using the browser's
 * own color engine. Returns null for colors the browser cannot parse.
 */
export function cssColorToRgb(color: string): [number, number, number] | null {
  const ctx = getProbe()
  if (!ctx || !color) return null
  try {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000000'
    ctx.fillStyle = color
    // An unparseable color leaves the previous fill (#000) unchanged, so the
    // assigned value differs from what we just set only when parsing worked.
    const accepted = ctx.fillStyle !== '#000000'
    ctx.fillRect(0, 0, 1, 1)
    if (!accepted) return null
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  } catch {
    return null
  }
}

/**
 * Read a CSS custom property from an element's computed style.
 *
 * Defaults to `document.body`: theme presets are applied as data attributes
 * on `<body>` (`data-theme-preset`, ...), and the dark class lives on the
 * root element, so the body's computed style resolves the effective value
 * for any descendant. Returns an empty string when undefined.
 */
export function getCssColorValue(
  varName: string,
  element: Element = document.body
): string {
  return getComputedStyle(element).getPropertyValue(varName).trim() ?? ''
}

/**
 * Read a CSS custom property and normalize it to RGB float components for
 * WebGL uniforms. Falls back to `fallback` when the variable is undefined or
 * cannot be parsed by the browser. `element` lets a caller resolve the value
 * against a scoped container (e.g. the landing wrapper) instead of the body.
 */
export function cssColorToVec3(
  varName: string,
  fallback: [number, number, number] = [0.5, 0.5, 0.5],
  element: Element = document.body
): [number, number, number] {
  const value = getCssColorValue(varName, element)
  const rgb = cssColorToRgb(value)
  if (!rgb) return fallback
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]
}
