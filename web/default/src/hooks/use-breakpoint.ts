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
import { useMediaQuery } from './use-media-query'

/**
 * Tailwind default breakpoints (px). Keep in sync with the utility
 * prefixes used in class names (sm:, md:, lg:, xl:).
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/** Matches viewports at or below the sm boundary (mobile card layouts). */
export function useSmDown(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`)
}

/** Matches viewports below the md boundary (mobile shell / drawer). */
export function useMdDown(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`)
}

/** Matches viewports at or above the lg boundary (desktop). */
export function useLgUp(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
}

/** Matches viewports at or above the xl boundary (wide desktop). */
export function useXlUp(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`)
}
