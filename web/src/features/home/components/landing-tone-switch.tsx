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
import { Check, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLandingTone } from '@/lib/landing-theme'
import { THEME_PRESETS } from '@/lib/theme-customization'
import { cn } from '@/lib/utils'

export function LandingToneSwitch() {
  const { t } = useTranslation()
  const { tone, setTone } = useLandingTone()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon' className='h-9 w-9' />}
      >
        <Palette className='size-[1.2rem]' />
        <span className='sr-only'>{t('Landing tone')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-52'>
        {THEME_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.value}
            onClick={() => setTone(preset.value)}
            className='flex items-center gap-2'
          >
            <span className='flex gap-0.5'>
              {preset.swatches.map((swatch) => (
                <span
                  key={swatch}
                  className='size-3 rounded-full border border-black/10 dark:border-white/10'
                  style={{ background: swatch }}
                />
              ))}
            </span>
            <span className='flex-1 text-sm'>{t(preset.name)}</span>
            <Check
              size={14}
              className={cn('ms-auto', tone !== preset.value && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
