/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { CheckCircle2, FolderLock, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { SectionHeading } from '@/components/section-heading'

export function TrustPanel() {
  const { t } = useTranslation()

  const guarantees = [
    {
      id: 'approval',
      icon: CheckCircle2,
      tone: 'text-success',
      title: t('Approval stays with you'),
      description: t(
        'Review consequential actions before they run. BoxAI shows what it plans to do and waits for your approval when it matters.'
      ),
    },
    {
      id: 'local',
      icon: LockKeyhole,
      tone: 'text-primary',
      title: t('Local by design'),
      description: t(
        'Local tools run on your device. You choose the files and connectors BoxAI can access, and you can revoke access at any time.'
      ),
    },
    {
      id: 'workspace',
      icon: FolderLock,
      tone: 'text-primary',
      title: t('Folders earn their permissions'),
      description: t(
        'A project only gets its own command allowances once you trust that folder, and you can withdraw that trust from Settings whenever you want.'
      ),
    },
  ]

  return (
    <section
      aria-labelledby='desktop-trust'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='desktop-trust'
          eyebrow={t('Control')}
          title={t('An agent with real access needs real brakes')}
          description={t(
            'BoxAI Desktop can touch your files, your terminal, and your accounts, so every one of those powers is gated by something you decide.'
          )}
        />
        <div className='grid gap-3 md:grid-cols-3'>
          {guarantees.map((guarantee, index) => {
            const Icon = guarantee.icon
            return (
              <AnimateInView key={guarantee.id} delay={80 + index * 70}>
                <article className='border-border bg-card h-full rounded-2xl border p-6 shadow-xs'>
                  <Icon
                    className={`${guarantee.tone} size-6`}
                    aria-hidden='true'
                  />
                  <h3 className='text-foreground mt-4 text-base font-semibold'>
                    {guarantee.title}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    {guarantee.description}
                  </p>
                </article>
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
