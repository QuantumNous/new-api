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
import type { Transition } from 'motion/react'

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const

const DURATION = {
  instant: 0,
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
} as const

export const MOTION_TRANSITION: Record<string, Transition> = {
  default: { duration: DURATION.normal, ease: EASE_OUT_CUBIC },
  fast: { duration: DURATION.fast, ease: EASE_OUT_CUBIC },
  slow: { duration: DURATION.slow, ease: EASE_OUT_CUBIC },
  spring: { type: 'spring', damping: 20, stiffness: 300 },
  none: { duration: DURATION.instant },
}

export const MOTION_VARIANTS = {
  // Admin surfaces keep page transitions to a bare opacity fade: no vertical
  // shift, no blur. Anything more reads as lag on high-frequency workflows.
  pageEnter: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  sidebarSlide: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
  },
} as const
