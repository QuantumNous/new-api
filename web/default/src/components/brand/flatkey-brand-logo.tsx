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

export const FLATKEY_LOGO_LIGHT = '/flatkey-logo-light.png'
export const FLATKEY_LOGO_DARK_BG = '/flatkey-logo-dark-bg.png'

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
  const lightModeImage = FLATKEY_LOGO_LIGHT
  const darkModeImage = FLATKEY_LOGO_DARK_BG
  const imageClass = cn('h-full w-full object-contain', imageClassName)

  if (variant === 'full') {
    return (
      <span className={cn('relative block overflow-hidden', className)}>
        <img
          src={lightModeImage}
          alt={alt}
          className={cn(imageClass, 'block dark:hidden')}
        />
        <img
          src={darkModeImage}
          alt={alt}
          className={cn(imageClass, 'hidden dark:block')}
        />
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className='relative h-8 w-14 shrink-0 overflow-hidden'>
        <span
          aria-hidden
          className='absolute inset-0 block bg-no-repeat dark:hidden'
          style={{
            backgroundImage: `url(${lightModeImage})`,
            backgroundPosition: '50% 32%',
            backgroundSize: '170%',
          }}
        />
        <span
          aria-hidden
          className='absolute inset-0 hidden bg-no-repeat dark:block'
          style={{
            backgroundImage: `url(${darkModeImage})`,
            backgroundPosition: '50% 32%',
            backgroundSize: '170%',
          }}
        />
      </span>
      <span className='bg-gradient-to-r from-slate-950 via-violet-950 to-violet-700 bg-clip-text text-[20px] leading-none font-bold tracking-[-0.01em] text-transparent dark:from-white dark:via-violet-100 dark:to-violet-300'>
        flatkey
      </span>
    </span>
  )
}
