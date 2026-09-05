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
import { useEffect, useRef } from 'react'

/**
 * Scroll-triggered reveal for the `.dopa-reveal` utility.
 *
 * Attach the returned ref to a container; every descendant carrying the
 * `dopa-reveal` class (including the container itself) gets
 * `data-revealed="true"` once it enters the viewport, which triggers the
 * CSS transition defined in `styles/dopamine.css`.
 */
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = root.classList.contains('dopa-reveal')
      ? [root, ...root.querySelectorAll<HTMLElement>('.dopa-reveal')]
      : [...root.querySelectorAll<HTMLElement>('.dopa-reveal')]

    if (targets.length === 0) return

    if (typeof IntersectionObserver === 'undefined') {
      for (const el of targets) el.dataset.revealed = 'true'
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).dataset.revealed = 'true'
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    for (const el of targets) {
      // Elements already in view on mount reveal immediately via observer.
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return ref
}
