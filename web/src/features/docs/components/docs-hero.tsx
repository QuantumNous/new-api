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
import { ArrowRight, BookOpen, Globe, KeyRound, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function DocsHero(props: { gatewayUrl: string }) {
  const { t } = useTranslation()

  return (
    <header className='border-border/40 relative overflow-hidden border-b'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-25 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 18% 12%, oklch(0.72 0.18 250 / 80%) 0%, transparent 72%)',
            'radial-gradient(ellipse 45% 38% at 82% 18%, oklch(0.65 0.15 200 / 55%) 0%, transparent 72%)',
            'radial-gradient(ellipse 40% 30% at 52% 85%, oklch(0.70 0.12 280 / 38%) 0%, transparent 75%)',
          ].join(', '),
        }}
      />
      <div className='mx-auto max-w-6xl px-4 pt-24 pb-10 sm:px-6 sm:pt-28 sm:pb-12'>
        <Badge
          variant='outline'
          className='bg-background/60 mb-5 backdrop-blur-sm'
        >
          <BookOpen aria-hidden='true' />
          {t('Documentation')}
        </Badge>
        <h1 className='max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl'>
          {t('Connect AI clients to this gateway')}
        </h1>
        <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-6 sm:text-base'>
          {t(
            'Use one gateway URL and API key to connect Claude Code, Codex CLI, Gemini CLI, DeepSeek Harness, or any OpenAI-compatible client.'
          )}
        </p>

        <div className='mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
          <div className='border-border/60 bg-background/70 flex max-w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 shadow-xs backdrop-blur-sm'>
            <Globe
              aria-hidden='true'
              className='text-muted-foreground size-4 shrink-0'
            />
            <code className='min-w-0 truncate font-mono text-xs sm:text-sm'>
              {props.gatewayUrl}
            </code>
            <CopyButton
              value={props.gatewayUrl}
              aria-label={t('Copy gateway URL')}
              tooltip={t('Copy gateway URL')}
              iconClassName='size-4'
              className='size-7'
            />
          </div>
          <Button render={<Link to='/keys' />}>
            <KeyRound aria-hidden='true' />
            {t('API Keys')}
            <ArrowRight aria-hidden='true' />
          </Button>
          <Button variant='outline' render={<a href='#one-click-setup' />}>
            <Terminal aria-hidden='true' />
            {t('One-click setup')}
          </Button>
        </div>
      </div>
    </header>
  )
}
