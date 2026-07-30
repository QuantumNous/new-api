/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'

import { ProseAccordion } from '@/components/prose-accordion'
import { SectionHeading } from '@/components/section-heading'

const QUESTIONS = [
  {
    id: 'existing-config',
    question: 'What happens to the configuration I already have?',
    answer:
      'It is kept. Connect backs up each client config before it writes, adds only the provider entry it owns, and restores your original file when you switch away or sign out.',
  },
  {
    id: 'byok',
    question: 'Can I keep using my own provider keys?',
    answer:
      'Yes, outside Connect. The panel shows the official login and the BoxAI entry so the one thing it manages stays obvious, but it never removes providers you configured yourself.',
  },
  {
    id: 'models',
    question: 'Which models can I pick?',
    answer:
      'Whatever your BoxAI account may call. The list comes from the server on every sign-in, and a model you can no longer reach is replaced rather than left in a config that would fail.',
  },
  {
    id: 'cc-switch',
    question: 'Is this the same as CC Switch?',
    answer:
      'BoxAI Connect is built on CC Switch and keeps its features. It adds BoxAI sign-in and the managed provider, and it stores its data separately, so it never touches an existing CC Switch installation.',
  },
  {
    id: 'platforms',
    question: 'Which platforms are supported?',
    answer:
      'macOS 12 or later on Apple Silicon and Intel, and Windows 10 or later on 64-bit. Linux is not packaged.',
  },
] as const

export function ConnectFaq() {
  const { t } = useTranslation()

  const entries = [
    {
      id: 'account',
      label: t('Do I need a BoxAI account?'),
      body: (
        <p>
          <Trans
            i18nKey='Yes. Connect signs in to your BoxAI account and configures your clients with a key issued to that account, so usage is billed and rate-limited exactly like the API. You can end the session at any time from <1>your profile</1>.'
            components={[
              <span key='0' />,
              <Link
                key='1'
                to='/profile'
                className='text-primary underline underline-offset-4'
              />,
            ]}
          />
        </p>
      ),
    },
    ...QUESTIONS.map((entry) => ({
      id: entry.id,
      label: t(entry.question),
      body: <p>{t(entry.answer)}</p>,
    })),
  ]

  return (
    <section
      aria-labelledby='connect-faq'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-3xl'>
        <SectionHeading
          id='connect-faq'
          eyebrow={t('FAQ')}
          title={t('Before you install')}
        />
        <ProseAccordion entries={entries} />
      </div>
    </section>
  )
}
