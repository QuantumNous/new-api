/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'

import { ProseAccordion } from './prose-accordion'
import { SectionHeading } from './section-heading'

const QUESTIONS = [
  {
    id: 'data',
    question: 'What leaves my computer?',
    answer:
      'Only what a model needs to answer: your prompt and the context you attach. Conversations, files, connector tokens, and workspace state stay in local storage on your machine.',
  },
  {
    id: 'keys',
    question: 'Can I plug in my own provider keys?',
    answer:
      'No. The desktop build routes every model call through your BoxAI account so billing and revocation always apply. Direct provider keys and custom endpoints are disabled.',
  },
  {
    id: 'safety',
    question: 'It can run shell commands. How is that safe?',
    answer:
      'Writes, sends, and shell commands are approval-gated by default: the app shows the exact action and waits. A folder also has to be trusted before its own command allowances count, and unattended runs park their questions in an inbox instead of deciding on their own.',
  },
  {
    id: 'usage',
    question: 'How do I know what a session costs?',
    answer:
      'The composer tracks the tokens a session has spent, and long conversations are compacted automatically so context stays affordable. Every call is metered against your BoxAI account, so it also shows up in your usage logs.',
  },
  {
    id: 'platforms',
    question: 'Which platforms are supported?',
    answer:
      'macOS 12 or later on Apple Silicon, and Windows 10 or later on 64-bit. Intel Macs and Linux are not packaged yet.',
  },
] as const

export function DesktopFaq() {
  const { t } = useTranslation()

  const entries = [
    {
      id: 'account',
      label: t('Do I need a BoxAI account?'),
      body: (
        <p>
          <Trans
            i18nKey='Yes. Model access comes from your BoxAI account, so usage is billed and rate-limited exactly like the API. You sign in once from the app and can revoke the device at any time from <1>your profile</1>.'
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
      aria-labelledby='desktop-faq'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='desktop-faq'
          eyebrow={t('Questions')}
          title={t('What people ask before installing')}
        />
        <ProseAccordion entries={entries} />
      </div>
    </section>
  )
}
