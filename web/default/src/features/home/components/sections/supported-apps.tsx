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
import { CherryStudio } from '@lobehub/icons'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

const APPS = [
  {
    name: 'Cherry Studio',
    href: 'https://cherry-ai.com',
    icon: 'cherry' as const,
  },
  { name: 'CC Switch', href: 'https://ccswitch.io', icon: 'cc' as const },
  { name: 'Cursor', href: 'https://cursor.com', icon: 'text' as const },
  { name: 'Dify', href: 'https://dify.ai', icon: 'text' as const },
  { name: 'Lobe Chat', href: 'https://lobehub.com', icon: 'text' as const },
  {
    name: 'VS Code',
    href: 'https://code.visualstudio.com',
    icon: 'text' as const,
  },
  {
    name: 'Claude Code',
    href: 'https://docs.anthropic.com',
    icon: 'text' as const,
  },
]

function AppIcon(props: { icon: (typeof APPS)[number]['icon']; name: string }) {
  if (props.icon === 'cherry') {
    return <CherryStudio.Color size={18} className='shrink-0' />
  }
  if (props.icon === 'cc') {
    return (
      <span className='flex size-5 items-center justify-center rounded-md bg-blue-500/10 text-[9px] font-bold text-blue-600 dark:text-blue-400'>
        CC
      </span>
    )
  }
  return (
    <span className='bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-md text-[10px] font-bold'>
      {props.name.charAt(0)}
    </span>
  )
}

export function SupportedApps() {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('Customers & Ecosystem')}
      className='border-border/40 bg-muted/20 relative z-10 border-y'
    >
      <div className='mx-auto max-w-6xl px-6 py-10 md:py-12'>
        <AnimateInView className='mb-6 text-center'>
          <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            {t('Supported Apps')}
          </p>
        </AnimateInView>
        <div className='flex flex-wrap items-center justify-center gap-3'>
          {APPS.map((app) => (
            <a
              key={app.name}
              href={app.href}
              target='_blank'
              rel='noopener noreferrer'
              className='border-border/50 bg-background/80 text-foreground/80 hover:border-border hover:text-foreground transition-ui inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-xs backdrop-blur-sm hover:scale-[1.02]'
            >
              <AppIcon icon={app.icon} name={app.name} />
              {app.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
