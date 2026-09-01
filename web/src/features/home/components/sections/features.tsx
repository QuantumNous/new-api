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
import {
  ArrowRight,
  Bot,
  Code2,
  Globe,
  MessageSquare,
  PiggyBank,
  ShieldCheck,
  Smile,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll'

interface FeaturesProps {
  className?: string
}

/** Tool wall: friendly names + category, colored by the candy palette. */
const toolWall = [
  { name: 'Cherry Studio', tag: 'chat', hue: 'var(--chart-1)' },
  { name: 'ChatBox', tag: 'chat', hue: 'var(--chart-3)' },
  { name: 'LobeChat', tag: 'chat', hue: 'var(--chart-4)' },
  { name: 'NextChat', tag: 'chat', hue: 'var(--chart-2)' },
  { name: 'Open WebUI', tag: 'chat', hue: 'var(--chart-5)' },
  { name: 'Claude Code', tag: 'code', hue: 'var(--chart-2)' },
  { name: 'Cline', tag: 'code', hue: 'var(--chart-1)' },
  { name: 'Cursor', tag: 'code', hue: 'var(--chart-4)' },
  { name: 'Zed', tag: 'code', hue: 'var(--chart-3)' },
  { name: '沉浸式翻译', tag: 'translate', hue: 'var(--chart-1)' },
  { name: '欧路词典', tag: 'translate', hue: 'var(--chart-4)' },
  { name: 'Dify', tag: 'agent', hue: 'var(--chart-3)' },
  { name: 'FastGPT', tag: 'agent', hue: 'var(--chart-2)' },
  { name: 'n8n', tag: 'agent', hue: 'var(--chart-5)' },
  { name: 'Obsidian', tag: 'notes', hue: 'var(--chart-4)' },
  { name: 'uTools', tag: 'notes', hue: 'var(--chart-1)' },
]

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()
  const sectionRef = useRevealOnScroll<HTMLElement>()

  const tagLabel: Record<string, string> = {
    chat: t('Chat'),
    code: t('Coding'),
    translate: t('Translate'),
    agent: t('Automation'),
    notes: t('Notes'),
  }

  const reasons = [
    {
      icon: <Smile className='size-6' strokeWidth={2} />,
      title: t('Made for beginners'),
      desc: t(
        'Plain-language guides for every tool. No jargon, no config files to hand-edit.'
      ),
      hue: 'var(--chart-1)',
    },
    {
      icon: <PiggyBank className='size-6' strokeWidth={2} />,
      title: t('One bill, pay as you go'),
      desc: t(
        'No monthly subscriptions per model. Top up once, use any model, see every cent.'
      ),
      hue: 'var(--chart-2)',
    },
    {
      icon: <Globe className='size-6' strokeWidth={2} />,
      title: t('Direct access, no VPN'),
      desc: t(
        'Reach top models from anywhere with a stable connection that just works.'
      ),
      hue: 'var(--chart-4)',
    },
    {
      icon: <ShieldCheck className='size-6' strokeWidth={2} />,
      title: t('Your key, your control'),
      desc: t(
        'Set spending limits and expiry dates per key. Revoke a key any time with one tap.'
      ),
      hue: 'var(--chart-3)',
    },
  ]

  const tagIcon: Record<string, React.ReactNode> = {
    chat: <MessageSquare className='size-3' />,
    code: <Code2 className='size-3' />,
    translate: <Globe className='size-3' />,
    agent: <Bot className='size-3' />,
    notes: <Wand2 className='size-3' />,
  }

  return (
    <section ref={sectionRef} className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        {/* Tool wall */}
        <div className='dopa-reveal mb-14 text-center'>
          <p className='text-primary mb-3 text-sm font-bold tracking-widest uppercase'>
            {t('Works with your tools')}
          </p>
          <h2 className='text-3xl font-extrabold tracking-tight text-balance md:text-4xl'>
            {t('Your favorite apps, instantly smarter')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-lg text-base text-pretty'>
            {t(
              'Paste one key into any of these — chat apps, coding assistants, translators and more.'
            )}
          </p>
        </div>

        <div className='dopa-reveal flex flex-wrap justify-center gap-3'>
          {toolWall.map((tool, i) => (
            <span
              key={tool.name}
              className='dopa-spring border-border bg-card inline-flex cursor-default items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold'
              style={{ transitionDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <span
                className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold'
                style={{
                  backgroundColor: `color-mix(in oklch, ${tool.hue} 15%, transparent)`,
                  color: tool.hue,
                }}
              >
                {tagIcon[tool.tag]}
                {tagLabel[tool.tag]}
              </span>
              {tool.name}
            </span>
          ))}
          <Button
            variant='ghost'
            className='dopa-spring text-primary h-auto rounded-full px-4 py-2.5 text-sm font-bold'
            render={<Link to='/guide' />}
          >
            {t('See all 30+ tools')}
            <ArrowRight className='ml-1 size-3.5' />
          </Button>
        </div>

        {/* Why us */}
        <div className='mt-28'>
          <div className='dopa-reveal mb-14 text-center'>
            <p className='text-primary mb-3 text-sm font-bold tracking-widest uppercase'>
              {t('Why people love it')}
            </p>
            <h2 className='text-3xl font-extrabold tracking-tight text-balance md:text-4xl'>
              {t('AI without the headaches')}
            </h2>
          </div>

          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
            {reasons.map((r, i) => (
              <div
                key={r.title}
                className='dopa-reveal dopa-lift border-border bg-card flex flex-col rounded-3xl border p-7'
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className='mb-5 flex size-14 items-center justify-center rounded-2xl'
                  style={{
                    backgroundColor: `color-mix(in oklch, ${r.hue} 14%, transparent)`,
                    color: r.hue,
                  }}
                >
                  {r.icon}
                </div>
                <h3 className='mb-2 text-base font-bold'>{r.title}</h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
