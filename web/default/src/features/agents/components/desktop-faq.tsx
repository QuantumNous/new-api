/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const QUESTIONS = [
  {
    id: 'account',
    question: 'Do I need a BoxAI account?',
    answer:
      'Yes. Model access comes from your BoxAI account, so usage is billed and rate-limited exactly like the API. You sign in once from the app and can revoke the device at any time from your profile.',
  },
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
      'Writes, sends, and shell commands are approval-gated by default: the app shows the exact action and waits. Unattended runs park their questions in an inbox instead of deciding on their own.',
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

  return (
    <section aria-labelledby='desktop-faq'>
      <div className='mb-4'>
        <h2 id='desktop-faq' className='text-foreground text-xl font-semibold'>
          {t('Questions')}
        </h2>
      </div>
      <Accordion className='border-border bg-card rounded-xl border px-4'>
        {QUESTIONS.map((entry) => (
          <AccordionItem key={entry.id} value={entry.id}>
            <AccordionTrigger>{t(entry.question)}</AccordionTrigger>
            <AccordionContent className='text-muted-foreground pb-4 text-sm leading-6'>
              {t(entry.answer)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
