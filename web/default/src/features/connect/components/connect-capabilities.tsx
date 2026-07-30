/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Boxes,
  KeyRound,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { SectionHeading } from '@/components/section-heading'

const CAPABILITIES = [
  {
    title: 'Browser sign-in, no key handling',
    description:
      'Approve the sign-in in your browser under the session you already have. The key is issued to the app and never shown, pasted, or typed.',
    icon: KeyRound,
  },
  {
    title: 'Writes the config for you',
    description:
      'The endpoint, key, and model land in each client’s real config file, in the shape that client expects.',
    icon: ListChecks,
  },
  {
    title: 'Backs up and restores',
    description:
      'Whatever was in the file before is kept. Switch away or sign out and your original configuration comes back.',
    icon: Undo2,
  },
  {
    title: 'Models come from your account',
    description:
      'The model list is whatever your account may actually call. Change plans and the choices follow, with no app update.',
    icon: RefreshCw,
  },
  {
    title: 'One place for MCP and skills',
    description:
      'Manage MCP servers and skills across every client from a single panel instead of seven separate files.',
    icon: Boxes,
  },
  {
    title: 'Revoke from anywhere',
    description:
      'Every install is a session you can end from the website. Signing out disables its key and withdraws the config it wrote.',
    icon: ShieldCheck,
  },
] as const

export function ConnectCapabilities() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby='connect-capabilities'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='connect-capabilities'
          eyebrow={t('Capabilities')}
          title={t('Set up once, stay in control')}
          description={t(
            'Connect only touches the provider entry it owns. Everything else in your client configuration stays yours.'
          )}
        />
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {CAPABILITIES.map((capability, index) => {
            const Icon = capability.icon
            return (
              <AnimateInView key={capability.title} delay={60 + index * 60}>
                <article className='border-border/50 bg-card hover:border-border hover:bg-muted/20 transition-ui h-full rounded-2xl border p-6 shadow-xs'>
                  <div className='bg-muted text-foreground mb-4 flex size-10 items-center justify-center rounded-xl'>
                    <Icon
                      className='size-5'
                      strokeWidth={1.5}
                      aria-hidden='true'
                    />
                  </div>
                  <h3 className='text-foreground text-sm font-semibold'>
                    {t(capability.title)}
                  </h3>
                  <p className='text-muted-foreground mt-1.5 text-sm leading-6'>
                    {t(capability.description)}
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
