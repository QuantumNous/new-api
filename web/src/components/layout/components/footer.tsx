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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className={cn('relative z-10', props.className)}>
      <div className='mx-auto flex max-w-6xl justify-center px-6 py-8'>
        <span className='text-muted-foreground/50 text-center text-xs'>
          &copy; {currentYear}{' '}
          <a
            href='https://github.com/QuantumNous/new-api'
            target='_blank'
            rel='noopener noreferrer'
            className='text-foreground/70 hover:text-foreground font-semibold transition-colors'
          >
            {t('New API')}
          </a>
          . {t('footer.defaultCopyright')}
        </span>
      </div>
    </footer>
  )
}
