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
import { useCallback, useState } from 'react'

import {
  THEME_PRESET_VALUES,
  type ThemePreset,
} from '@/lib/theme-customization'

/**
 * Landing tone state, fully decoupled from the user's global theme settings.
 *
 * The public landing page applies its chosen tone via `data-landing-tone` on
 * a wrapper (see landing-theme.css). The choice lives in localStorage under a
 * dedicated key so it never touches the global `theme_preset` cookie.
 */
const LANDING_TONE_KEY = 'landing-tone'

function readInitialTone(): ThemePreset {
  if (typeof window === 'undefined') return 'default'
  const stored = window.localStorage.getItem(LANDING_TONE_KEY)
  return stored && THEME_PRESET_VALUES.has(stored as ThemePreset)
    ? (stored as ThemePreset)
    : 'default'
}

export function useLandingTone(): {
  tone: ThemePreset
  setTone: (tone: ThemePreset) => void
} {
  const [tone, setToneState] = useState<ThemePreset>(readInitialTone)

  const setTone = useCallback((next: ThemePreset) => {
    setToneState(next)
    try {
      window.localStorage.setItem(LANDING_TONE_KEY, next)
    } catch {
      // Storage may be unavailable (private mode, blocked cookies).
    }
  }, [])

  return { tone, setTone }
}
