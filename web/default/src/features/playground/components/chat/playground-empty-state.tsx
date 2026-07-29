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
import {
  BarChartIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  MessageSquarePlusIcon,
  NotepadTextIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PlaygroundEmptyStateProps = {
  onSelectPrompt: (prompt: string) => void
}

const starterPrompts = [
  { icon: BarChartIcon, text: 'Analyze data', accent: 'text-chart-1' },
  { icon: NotepadTextIcon, text: 'Summarize text', accent: 'text-chart-2' },
  { icon: CodeSquareIcon, text: 'Code', accent: 'text-chart-3' },
  { icon: GraduationCapIcon, text: 'Get advice', accent: 'text-chart-4' },
]

export function PlaygroundEmptyState({
  onSelectPrompt,
}: PlaygroundEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className='flex min-h-[min(520px,calc(100svh-18rem))] items-center justify-center px-1 py-8 md:py-12'>
      <StaggerContainer className='grid w-full max-w-2xl gap-5 text-center'>
        <StaggerItem className='relative mx-auto'>
          <div
            className='from-primary/40 via-chart-3/25 to-chart-4/20 generation-glow-pulse pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-br blur-2xl'
            aria-hidden='true'
          />
          <div className='from-primary/20 to-chart-3/15 text-primary ring-primary/25 relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1'>
            <MessageSquarePlusIcon className='size-5' aria-hidden='true' />
          </div>
        </StaggerItem>

        <StaggerItem className='grid gap-2'>
          <h2 className='text-xl font-semibold tracking-tight text-balance md:text-2xl'>
            {t('Start a playground chat')}
          </h2>
          <p className='text-muted-foreground mx-auto max-w-lg text-sm leading-6 text-balance'>
            {t(
              'Test a model with a starter prompt, or write your own request below.'
            )}
          </p>
        </StaggerItem>

        <StaggerItem className='grid gap-2 sm:grid-cols-2'>
          {starterPrompts.map(({ icon: Icon, text, accent }) => {
            const prompt = t(text)

            return (
              <Button
                className='hover:border-primary/30 transition-ui h-auto min-h-11 justify-start gap-2 px-3 py-2.5 text-left whitespace-normal hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0'
                key={text}
                onClick={() => onSelectPrompt(prompt)}
                variant='outline'
              >
                <Icon className={cn('size-4', accent)} />
                <span>{prompt}</span>
              </Button>
            )
          })}
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}
