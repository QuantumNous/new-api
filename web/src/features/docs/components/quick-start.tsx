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
import { Link } from '@tanstack/react-router'
import { ArrowRight, KeyRound, Server, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { DocsSection } from './docs-section'

const STEPS = [
  {
    icon: KeyRound,
    title: 'Create an API key',
    description:
      'Open API Keys and create a key for the clients you plan to connect.',
  },
  {
    icon: Server,
    title: 'Copy the gateway URL',
    description:
      'Use the URL shown on this page. It already points at the current deployment.',
  },
  {
    icon: Terminal,
    title: 'Configure your client',
    description:
      'Run the one-click setup command or edit the client configuration manually.',
  },
] as const

export function QuickStartSection() {
  const { t } = useTranslation()

  return (
    <DocsSection
      id='quick-start'
      title={t('Quick start')}
      description={t(
        'Create a key, point the client at this gateway, then start using your models.'
      )}
    >
      <div className='grid gap-3 md:grid-cols-3'>
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <Card key={step.title} size='sm' className='h-full'>
              <CardContent className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg'>
                    <Icon aria-hidden='true' className='size-4' />
                  </div>
                  <span className='text-muted-foreground/45 font-mono text-xs'>
                    0{index + 1}
                  </span>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium'>{t(step.title)}</h3>
                  <p className='text-muted-foreground text-sm leading-5'>
                    {t(step.description)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Button variant='outline' size='sm' render={<Link to='/keys' />}>
        {t('Open API Keys')}
        <ArrowRight aria-hidden='true' />
      </Button>
    </DocsSection>
  )
}
