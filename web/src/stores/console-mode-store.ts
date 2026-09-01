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
import { create } from 'zustand'

export type ConsoleMode = 'easy' | 'developer'

const CONSOLE_MODE_STORAGE_KEY = 'yecai_console_mode'

export function normalizeConsoleMode(value: unknown): ConsoleMode {
  return value === 'developer' ? 'developer' : 'easy'
}

function readConsoleMode(): ConsoleMode {
  if (typeof window === 'undefined') return 'easy'

  try {
    return normalizeConsoleMode(
      window.localStorage.getItem(CONSOLE_MODE_STORAGE_KEY)
    )
  } catch {
    return 'easy'
  }
}

function saveConsoleMode(mode: ConsoleMode): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CONSOLE_MODE_STORAGE_KEY, mode)
  } catch {
    /* Local storage is optional; the current session still keeps the mode. */
  }
}

type ConsoleModeState = {
  mode: ConsoleMode
  setMode: (mode: ConsoleMode) => void
}

export const useConsoleModeStore = create<ConsoleModeState>()((set) => ({
  mode: readConsoleMode(),
  setMode: (mode) => {
    saveConsoleMode(mode)
    set({ mode })
  },
}))
