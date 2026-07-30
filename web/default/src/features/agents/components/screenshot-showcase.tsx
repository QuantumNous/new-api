/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { SectionHeading } from './section-heading'

// Captured from the real app by desktop/surfaces/gui `npm run screenshots`, which drives the
// hermetic e2e mocks — regenerating them after a UI change needs no manual retouching.
const SHOTS = [
  {
    id: 'session',
    tab: 'Finished work',
    caption:
      'Ask for an outcome and BoxAI returns the deliverable, not a list of steps.',
  },
  {
    id: 'approval',
    tab: 'Approvals',
    caption:
      'Anything consequential stops for your review, with the exact action spelled out.',
  },
  {
    id: 'inbox',
    tab: 'Inbox',
    caption:
      'Work running unattended parks its questions here instead of deciding on its own.',
  },
  {
    id: 'skills',
    tab: 'Skills',
    caption:
      'Instruction packs teach it repeatable work: reports, minutes, decks, spreadsheets.',
  },
  {
    id: 'connectors',
    tab: 'Connectors',
    caption:
      'Slack, GitHub, Gmail, Notion, Jira and more, plus anything reachable over MCP.',
  },
  {
    id: 'automations',
    tab: 'Automations',
    caption:
      'Standing work runs on a schedule and lands in the app with a full transcript.',
  },
] as const

type ShotId = (typeof SHOTS)[number]['id']

export function ScreenshotShowcase() {
  const { t } = useTranslation()
  const [active, setActive] = useState<ShotId>(SHOTS[0].id)

  return (
    <section
      aria-labelledby='desktop-screenshots'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='desktop-screenshots'
          eyebrow={t('A look inside')}
          title={t('The app running a real task, end to end')}
        />

        <AnimateInView delay={80}>
          <Tabs
            value={active}
            onValueChange={(value) => setActive(value as ShotId)}
          >
            <TabsList className='flex-wrap'>
              {SHOTS.map((shot) => (
                <TabsTrigger key={shot.id} value={shot.id}>
                  {t(shot.tab)}
                </TabsTrigger>
              ))}
            </TabsList>

            {SHOTS.map((shot) => (
              <TabsContent key={shot.id} value={shot.id} className='mt-5'>
                <figure className='space-y-3'>
                  <div className='border-border bg-muted overflow-hidden rounded-2xl border shadow-sm'>
                    <img
                      src={`/desktop-screenshots/${shot.id}-1536.webp`}
                      srcSet={[
                        `/desktop-screenshots/${shot.id}-480.webp 480w`,
                        `/desktop-screenshots/${shot.id}-960.webp 960w`,
                        `/desktop-screenshots/${shot.id}-1536.webp 1536w`,
                      ].join(', ')}
                      sizes='(min-width: 1024px) 1100px, 100vw'
                      width={1536}
                      height={960}
                      loading='lazy'
                      decoding='async'
                      alt={t(shot.caption)}
                      className='block w-full'
                    />
                  </div>
                  <figcaption className='text-muted-foreground text-sm'>
                    {t(shot.caption)}
                  </figcaption>
                </figure>
              </TabsContent>
            ))}
          </Tabs>
        </AnimateInView>
      </div>
    </section>
  )
}
