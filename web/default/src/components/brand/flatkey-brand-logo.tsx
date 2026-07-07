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
import { cn } from '@/lib/utils'

// Brand v5 (design doc "Flatkey Logo 方案" card 5a): gradient shield-key mark +
// single-color "flatkey.ai" wordmark in Space Grotesk SemiBold, lowercase.
// Wordmark color is #1E1B4B on light, near-white on dark — no gradient text.
export const FLATKEY_LOGO_LIGHT = '/flatkey-lockup-light.svg'
export const FLATKEY_LOGO_DARK_BG = '/flatkey-lockup-dark.svg'
export const FLATKEY_MARK = '/flatkey-mark.svg'

const WORDMARK_FONT_FAMILY =
  "'Space Grotesk', Inter, 'SF Pro Display', Arial, sans-serif"

type FlatkeyBrandLogoProps = {
  alt?: string
  className?: string
  imageClassName?: string
  variant?: 'lockup' | 'full'
}

export function FlatkeyBrandLogo({
  alt = 'Flatkey',
  className,
  imageClassName,
  variant = 'lockup',
}: FlatkeyBrandLogoProps) {
  const imageClass = cn('h-full w-full object-contain', imageClassName)

  if (variant === 'full') {
    return (
      <span className={cn('relative block overflow-hidden', className)}>
        <img
          src={FLATKEY_LOGO_LIGHT}
          alt={alt}
          className={cn(imageClass, 'block dark:hidden')}
        />
        <img
          src={FLATKEY_LOGO_DARK_BG}
          alt={alt}
          className={cn(imageClass, 'hidden dark:block')}
        />
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={FLATKEY_MARK}
        alt=''
        aria-hidden
        className='h-8 w-8 shrink-0'
      />
      <span
        className='text-[20px] leading-none font-semibold text-[#1E1B4B] dark:text-slate-50'
        style={{ fontFamily: WORDMARK_FONT_FAMILY }}
      >
        flatkey.ai
      </span>
    </span>
  )
}
