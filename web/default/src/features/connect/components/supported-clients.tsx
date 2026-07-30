/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { SectionHeading } from '@/components/section-heading'

/**
 * The clients BoxAI Connect writes a provider into, and the file it writes.
 *
 * Must stay in step with `SUPPORTED_APPS` in
 * `connect/src-tauri/src/boxai/provider_seed.rs`. A client advertised here that
 * the app does not seed is a promise the download does not keep.
 */
const CLIENTS = [
  { name: 'Claude Code', config: '~/.claude/settings.json' },
  { name: 'Codex CLI', config: '~/.codex/config.toml' },
  { name: 'Gemini CLI', config: '~/.gemini/settings.json' },
  { name: 'Grok Build', config: '~/.grok/config.toml' },
  { name: 'OpenCode', config: '~/.config/opencode' },
  { name: 'OpenClaw', config: '~/.openclaw/openclaw.json' },
  { name: 'Hermes', config: '~/.hermes/config.yaml' },
] as const

export function SupportedClients() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby='connect-clients'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='connect-clients'
          eyebrow={t('Supported clients')}
          title={t('Seven clients, one sign-in')}
          description={t(
            'Each client keeps its own config file. Connect writes only the entry it owns, leaves everything else alone, and keeps a backup it can restore.'
          )}
        />
        <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {CLIENTS.map((client, index) => (
            <AnimateInView key={client.name} delay={60 + index * 40}>
              <li className='border-border/50 bg-card hover:border-border transition-ui h-full list-none rounded-2xl border p-5 shadow-xs'>
                <h3 className='text-foreground text-sm font-semibold'>
                  {client.name}
                </h3>
                <p className='text-muted-foreground mt-1.5 font-mono text-xs break-all'>
                  {client.config}
                </p>
              </li>
            </AnimateInView>
          ))}
        </ul>
      </div>
    </section>
  )
}
