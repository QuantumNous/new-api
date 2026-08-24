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
import { Braces, Bot, Terminal, TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import type { IntegrationId } from './integration-snippets'

interface IntegrationCard {
  id: IntegrationId
  title: string
  description: string
  icon: typeof Braces
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIntegrationCards(): IntegrationCard[] {
  const { t } = useTranslation()

  return [
    {
      id: 'api',
      title: t('API for developers'),
      description: t(
        'Call any model with an OpenAI-compatible API. Copy a ready-to-run example for your model and language.'
      ),
      icon: TerminalSquare,
    },
    {
      id: 'sdk',
      title: t('SDKs for developers'),
      description: t(
        'Use the OpenAI SDK you already know — with Flatkey as the gateway.'
      ),
      icon: Braces,
    },
    {
      id: 'cli',
      title: t('Flatkey CLI'),
      description: t(
        'Generate images and videos from your terminal. Let your AI assistant drive the workflow.'
      ),
      icon: Terminal,
    },
    {
      id: 'agent',
      title: t('Codex & Claude Code'),
      description: t(
        'Connect your coding agent with one command, then use Flatkey from your existing projects.'
      ),
      icon: Bot,
    },
  ]
}

export function IntegrationCards(props: {
  onSelect: (id: IntegrationId) => void
}) {
  const { t } = useTranslation()
  const cards = useIntegrationCards()

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-lg font-semibold'>
          {t("Choose how you'll use Flatkey")}
        </h2>
        <p className='text-muted-foreground text-sm'>
          {t('All four options use the same account and model catalog.')}
        </p>
      </div>

      <CardStaggerContainer className='grid gap-3 md:grid-cols-2'>
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <CardStaggerItem key={card.id}>
              <button
                type='button'
                onClick={() => props.onSelect(card.id)}
                className='bg-card hover:border-primary/50 focus-visible:ring-ring flex h-full w-full flex-col items-start gap-4 rounded-xl border p-5 text-left shadow-xs transition-colors hover:shadow-md focus-visible:ring-2 focus-visible:outline-none'
              >
                <span className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl'>
                  <Icon className='size-5' aria-hidden='true' />
                </span>
                <span className='flex flex-col gap-1'>
                  <span className='font-semibold'>{card.title}</span>
                  <span className='text-muted-foreground text-sm leading-relaxed'>
                    {card.description}
                  </span>
                </span>
              </button>
            </CardStaggerItem>
          )
        })}
      </CardStaggerContainer>
    </section>
  )
}
