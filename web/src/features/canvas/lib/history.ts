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
export interface CanvasHistoryEntry {
  id: string
  image: string
  prompt: string
  model: string
  group: string
  size: string
  n: number
  createdAt: number
}

const HISTORY_KEY = 'canvas_history'
const MAX_ENTRIES = 50

export function loadHistory(): CanvasHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: CanvasHistoryEntry): void {
  const next = [entry, ...loadHistory()].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // Storage full (e.g. many data URLs). Keep the newest entries.
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 20)))
    } catch {
      /* give up silently */
    }
  }
}

export function removeHistoryEntry(id: string): void {
  const next = loadHistory().filter((entry) => entry.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

export async function downloadImage(src: string, filename: string): Promise<void> {
  if (src.startsWith('data:')) {
    const anchor = document.createElement('a')
    anchor.href = src
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }

  try {
    const response = await fetch(src)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch {
    window.open(src, '_blank', 'noopener')
  }
}
