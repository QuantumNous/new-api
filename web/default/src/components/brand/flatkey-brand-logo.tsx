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

// Single brand standard (matches the official website's compact navigation):
// the gradient "flatkey-mark" tile + a single-color "flatkey" wordmark (no ".ai")
// in Public Sans Bold, lowercase. Its responsive 38/30, 36/28, and 40/32
// mark/wordmark pairings mirror the website navigation at the same viewport.
export const FLATKEY_LOGO_LIGHT = '/flatkey-lockup-light.svg'
export const FLATKEY_LOGO_DARK_BG = '/flatkey-lockup-dark.svg'
export const FLATKEY_MARK = '/flatkey-mark.svg'

const WORDMARK_FONT_FAMILY = "'Public Sans', Inter, -apple-system, sans-serif"

type FlatkeyBrandLogoProps = {
  alt?: string
  className?: string
  imageClassName?: string
  markClassName?: string
  variant?: 'lockup' | 'full'
  wordmarkClassName?: string
}

export function FlatkeyBrandLogo({
  alt = 'flatkey',
  className,
  imageClassName,
  markClassName,
  variant = 'lockup',
  wordmarkClassName,
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
    <span
      data-flatkey-brand='lockup'
      className={cn(
        'inline-flex items-center gap-[9px] min-[901px]:gap-2 min-[1481px]:gap-[9px]',
        className
      )}
    >
      <img
        src={FLATKEY_MARK}
        alt=''
        aria-hidden
        className={cn(
          'h-[38px] w-[38px] shrink-0 min-[901px]:h-9 min-[901px]:w-9 min-[1481px]:h-10 min-[1481px]:w-10',
          markClassName
        )}
      />
      <span
        data-flatkey-wordmark
        className={cn(
          'text-[30px] leading-none font-bold text-[#0B0B0F] min-[901px]:text-[28px] min-[1481px]:text-[32px] dark:text-[#F5F5F2]',
          wordmarkClassName
        )}
        style={{ fontFamily: WORDMARK_FONT_FAMILY, letterSpacing: '-0.043em' }}
      >
        flatkey
      </span>
    </span>
  )
}
