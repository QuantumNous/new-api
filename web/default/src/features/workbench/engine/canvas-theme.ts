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
import { useTheme } from '@/context/theme-provider'

export type CanvasColorTheme = 'light' | 'dark'

export const canvasThemes = {
  light: {
    canvas: {
      background: '#ffffff',
      dot: 'rgba(15,23,42,.14)',
      line: 'rgba(15,23,42,.065)',
      selectionFill: 'rgba(79,110,232,.10)',
    },
    node: {
      label: '#4b5563',
      fill: '#ffffff',
      panel: '#ffffff',
      stroke: '#e2e4e8',
      activeStroke: '#111827',
      placeholder: '#9ca3af',
      text: '#111827',
      muted: '#6b7280',
      faint: '#9ca3af',
    },
    frame: {
      fill: 'rgba(17,24,39,.025)',
      stroke: 'rgba(17,24,39,.18)',
      activeFill: 'rgba(79,110,232,.05)',
      activeStroke: '#4f6ee8',
      preview: 'rgba(255,255,255,.82)',
    },
    toolbar: {
      panel: 'rgba(255,255,255,.94)',
      border: 'rgba(17,24,39,.10)',
      item: '#4b5563',
      itemHover: 'rgba(17,24,39,.06)',
      activeBg: 'rgba(17,24,39,.10)',
      activeText: '#111827',
    },
    spatial: {
      surface: 'rgba(255,255,255,.72)',
      elevated: 'rgba(255,255,255,.94)',
      dropzone: 'rgba(248,250,252,.78)',
      glow: 'rgba(79,110,232,.18)',
      glowStrong: 'rgba(79,110,232,.52)',
      shadow: 'rgba(15,23,42,.18)',
    },
    accent: {
      primary: '#4f6ee8',
      primarySoft: 'rgba(79,110,232,.14)',
      danger: '#f87171',
    },
  },
  dark: {
    canvas: {
      background: '#111111',
      dot: 'rgba(245,245,245,.16)',
      line: 'rgba(245,245,245,.065)',
      selectionFill: 'rgba(91,110,225,.16)',
    },
    node: {
      label: '#a3a3a3',
      fill: '#242424',
      panel: '#202020',
      stroke: 'rgba(255,255,255,.13)',
      activeStroke: '#f5f5f5',
      placeholder: '#777777',
      text: '#f5f5f5',
      muted: '#a3a3a3',
      faint: '#666666',
    },
    frame: {
      fill: 'rgba(255,255,255,.025)',
      stroke: 'rgba(255,255,255,.18)',
      activeFill: 'rgba(91,110,225,.08)',
      activeStroke: '#8290f0',
      preview: 'rgba(24,24,24,.86)',
    },
    toolbar: {
      panel: 'rgba(36,36,36,.94)',
      border: 'rgba(255,255,255,.12)',
      item: '#d4d4d4',
      itemHover: 'rgba(255,255,255,.08)',
      activeBg: 'rgba(255,255,255,.13)',
      activeText: '#ffffff',
    },
    spatial: {
      surface: 'rgba(30,30,32,.72)',
      elevated: 'rgba(22,22,24,.94)',
      dropzone: 'rgba(10,10,12,.78)',
      glow: 'rgba(130,144,240,.2)',
      glowStrong: 'rgba(130,144,240,.58)',
      shadow: 'rgba(0,0,0,.46)',
    },
    accent: {
      primary: '#8290f0',
      primarySoft: 'rgba(91,110,225,.2)',
      danger: '#fb7185',
    },
  },
} as const

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme]

export function useCanvasTheme(): CanvasTheme {
  const { resolvedTheme } = useTheme()
  return canvasThemes[resolvedTheme === 'dark' ? 'dark' : 'light']
}
