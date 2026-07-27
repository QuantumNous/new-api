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
import { InformationCircleIcon, Key01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

const CLAUDE_ENV_REFERENCE_URL = 'https://code.claude.com/docs/en/env-vars'
const CLAUDE_MODEL_REFERENCE_URL =
  'https://code.claude.com/docs/en/model-config'

export function DocsClaudeCode() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const powershellConfig = `[Environment]::SetEnvironmentVariable(
  "ANTHROPIC_AUTH_TOKEN",
  "sk-your-api-key",
  "User"
)
[Environment]::SetEnvironmentVariable(
  "ANTHROPIC_BASE_URL",
  "${baseUrl}",
  "User"
)
[Environment]::SetEnvironmentVariable(
  "ANTHROPIC_MODEL",
  "your-claude-model-id",
  "User"
)`
  const shellConfig = `export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_MODEL="your-claude-model-id"`

  return (
    <DocsShell
      pageId='claude-code'
      title='Claude Code'
      description={t(
        'Connect Claude Code through CC Switch or Anthropic-compatible environment variables.'
      )}
      toc={[
        { id: 'cc-switch-import', label: t('Import with CC Switch') },
        { id: 'manual-configuration', label: t('Manual configuration') },
        { id: 'verify', label: t('Restart and verify') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='cc-switch-import' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Import with CC Switch')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The API key page can send Claude Code settings directly to CC Switch, including the service root, API key, and selected model.'
          )}
        </p>
        <NumberedSteps
          items={[
            t('Open the API keys page and choose the CC Switch action.'),
            t(
              'Select Claude (used by Claude Code) and choose an available Claude model.'
            ),
            t('Approve the import, save the provider, and switch to it.'),
            t('Restart Claude Code so it reads the new configuration.'),
          ]}
        />
        <Button className='mt-5' render={<Link to='/keys' />}>
          <HugeiconsIcon icon={Key01Icon} data-icon='inline-start' />
          {t('Open API keys')}
        </Button>
      </section>

      <section id='manual-configuration' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Manual configuration')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Set the Anthropic authentication token, service root, and exact model ID in the terminal that starts Claude Code.'
          )}
        </p>
        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          <CodeBlock code={powershellConfig} label='PowerShell' />
          <CodeBlock code={shellConfig} label='macOS / Linux' />
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Base URL requirement')}</AlertTitle>
          <AlertDescription>
            {t(
              'Use the service root shown above without /v1. Claude Code appends Anthropic API paths itself.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='verify' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Restart and verify')}</h2>
        <NumberedSteps
          items={[
            t(
              'Open a new terminal after saving persistent variables; keep using the current terminal when you used export.'
            ),
            t('Run claude and start a new session with a short prompt.'),
            t(
              'Open usage logs and confirm the request used the intended model.'
            ),
          ]}
        />
        <div className='mt-5'>
          <CodeBlock code='claude' label={t('Terminal')} />
        </div>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'For authentication errors, confirm ANTHROPIC_AUTH_TOKEN is visible in the same terminal.'
            ),
            t(
              'For model errors, copy the exact model ID from the pricing page instead of using a display name.'
            ),
            t(
              'For 404 errors, remove /v1 from ANTHROPIC_BASE_URL and restart Claude Code.'
            ),
            t(
              'If a remote tool or beta feature fails, verify that the selected channel supports that Anthropic capability.'
            ),
          ]}
        />
        <div className='mt-5 flex flex-wrap gap-4'>
          <a
            href={CLAUDE_ENV_REFERENCE_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='text-foreground underline underline-offset-4'
          >
            {t('Claude Code environment variables')}
          </a>
          <a
            href={CLAUDE_MODEL_REFERENCE_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='text-foreground underline underline-offset-4'
          >
            {t('Claude Code model configuration')}
          </a>
        </div>
      </section>
    </DocsShell>
  )
}
