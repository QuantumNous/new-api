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
import { useMemo } from 'react'

interface StarFieldProps {
  count?: number
}

/**
 * Renders a fixed grid of CSS-animated star particles behind hero content.
 * Pure CSS animation — no JS runtime cost after mount.
 */
export function StarField({ count = 45 }: StarFieldProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = (i * 137.5 + 73) % 360 // golden-angle-like spread
        return {
          id: i,
          left: `${((seed * 1.7 + i * 3.1) % 97) + 1}%`,
          top: `${((seed * 2.3 + i * 1.9) % 95) + 2}%`,
          size: (i % 3 === 0 ? 2.5 : i % 5 === 0 ? 2 : 1.2) + Math.random() * 0.5,
          duration: 3 + (i % 7) * 0.8,
          delay: (i % 11) * 0.35,
          driftDuration: 5 + (i % 5) * 1.2,
        }
      }),
    [count]
  )

  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
      {stars.map((star) => (
        <div
          key={star.id}
          className='animate-star absolute rounded-full'
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--star-duration': `${star.duration}s`,
            '--star-drift-duration': `${star.driftDuration}s`,
            '--star-delay': `${star.delay}s`,
            backgroundColor:
              star.id % 3 === 0
                ? 'oklch(0.85 0.1 85)'   // warm gold
                : star.id % 3 === 1
                  ? 'oklch(0.9 0.08 200)' // cool white-blue
                  : 'oklch(0.8 0.06 280)', // faint violet
            boxShadow:
              star.size > 2
                ? `0 0 ${star.size * 1.5}px oklch(0.9 0.1 85 / 0.3)`
                : 'none',
          } as React.CSSProperties}
        />
      ))}
      {/* Subtle ambient twinkle layer — large soft blobs */}
      <div
        className='absolute top-[20%] left-[30%] size-48 rounded-full bg-cyan-500/2 blur-3xl'
      />
      <div
        className='absolute top-[60%] right-[20%] size-64 rounded-full bg-violet-500/2 blur-3xl'
      />
    </div>
  )
}
