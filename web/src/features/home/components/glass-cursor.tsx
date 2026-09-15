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
import { createPortal } from 'react-dom'

import './glass-cursor.css'

export function GlassCursor(props: { scopeSelector?: string }) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const scopeSelector = props.scopeSelector ?? '.ci-liquidHome'

  useEffect(() => {
    if (!cursorRef.current) return
    const cursor = cursorRef.current

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previousTime = 0
    let x = 0
    let y = 0
    let targetX = 0
    let targetY = 0

    function hide() {
      cursor.hidden = true
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
    }

    function animate(time: number) {
      const elapsed = previousTime ? Math.min(time - previousTime, 40) : 16
      previousTime = time
      const blend = 1 - Math.exp(-elapsed / 48)
      const dx = targetX - x
      const dy = targetY - y
      x += dx * blend
      y += dy * blend

      const distance = Math.hypot(targetX - x, targetY - y)
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`
      cursor.style.setProperty(
        '--cursor-trail',
        `${Math.min(distance * 0.85, 42)}px`
      )
      cursor.style.setProperty(
        '--cursor-trail-opacity',
        String(Math.min(distance / 20, 0.65))
      )
      if (distance > 0.1) {
        cursor.style.setProperty(
          '--cursor-angle',
          `${Math.atan2(dy, dx) + Math.PI}rad`
        )
        frame = window.requestAnimationFrame(animate)
      } else {
        frame = 0
        previousTime = 0
      }
    }

    function move(event: PointerEvent) {
      const target = event.target
      if (
        !finePointer.matches ||
        reducedMotion.matches ||
        event.pointerType !== 'mouse' ||
        event.buttons !== 0 ||
        !(target instanceof Element) ||
        (!target.closest(scopeSelector) &&
          !target.closest('[data-glass-cursor-surface]')) ||
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
        )
      ) {
        hide()
        return
      }
      targetX = event.clientX
      targetY = event.clientY
      cursor.dataset.interactive = String(
        Boolean(target.closest('a, button, [role="button"]'))
      )
      if (cursor.hidden) {
        x = targetX
        y = targetY
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`
        cursor.hidden = false
      }
      if (!frame) frame = window.requestAnimationFrame(animate)
    }

    // Tracking stays outside React renders and stops when the pointer settles.
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', hide, { passive: true })
    window.addEventListener('keydown', hide)
    window.addEventListener('blur', hide)
    document.addEventListener('pointerleave', hide)
    document.addEventListener('visibilitychange', hide)
    finePointer.addEventListener('change', hide)
    reducedMotion.addEventListener('change', hide)

    return () => {
      hide()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', hide)
      window.removeEventListener('keydown', hide)
      window.removeEventListener('blur', hide)
      document.removeEventListener('pointerleave', hide)
      document.removeEventListener('visibilitychange', hide)
      finePointer.removeEventListener('change', hide)
      reducedMotion.removeEventListener('change', hide)
    }
  }, [scopeSelector])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={cursorRef}
      className='ci-glassCursor'
      data-testid='glass-cursor'
      aria-hidden='true'
      hidden
    >
      <span className='ci-glassCursorTrail' />
      <span className='ci-glassCursorLens' />
    </div>,
    document.body
  )
}
