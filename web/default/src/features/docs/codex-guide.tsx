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
import {
  Download04Icon,
  InformationCircleIcon,
  Key01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

const CCSWITCH_RELEASES_URL = 'https://github.com/farion1231/cc-switch/releases'
const CODEX_CONFIG_REFERENCE_URL =
  'https://developers.openai.com/codex/config-reference'

export function DocsCodex() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const codexConfig = `model = "gpt-5.6-sol"
model_provider = "alltokenapi"

[model_providers.alltokenapi]
name = "All Token API"
base_url = "${baseUrl}/v1"
env_key = "ALLTOKEN_API_KEY"
wire_api = "responses"`
  const powershellApiKey = `[Environment]::SetEnvironmentVariable(
  "ALLTOKEN_API_KEY",
  "sk-your-api-key",
  "User"
)`
  const shellApiKey = `export ALLTOKEN_API_KEY="sk-your-api-key"`
  const windowsConfigPath = '%USERPROFILE%\\.codex\\config.toml'

  return (
    <DocsShell
      pageId='codex'
      title='Codex'
      description={t(
        'Choose CC Switch one-click import or edit config.toml manually to connect Codex.'
      )}
      toc={[
        {
          id: 'cc-switch-import',
          label: t('1. Import with CC Switch'),
        },
        {
          id: 'manual-config',
          label: t('2. Configure config.toml manually'),
        },
      ]}
    >
      <section id='cc-switch-import' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('1. Import with CC Switch')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'CC Switch is the fastest setup path. It imports the API key, selected model, and Codex service endpoint without editing TOML by hand.'
          )}
        </p>
        <NumberedSteps
          items={[
            t(
              'Install CC Switch and confirm that the ccswitch:// protocol is registered.'
            ),
            t('Open the API keys page and locate the key you want to use.'),
            t('Open the row actions and choose the CC Switch import action.'),
            t(
              'Select Codex, choose a primary model available to the API key, and keep the generated /v1 endpoint.'
            ),
            t(
              'Confirm the browser prompt, then review and save the imported provider in CC Switch.'
            ),
          ]}
        />
        <div className='mt-6 flex flex-wrap gap-3'>
          <Button render={<Link to='/keys' />}>
            <HugeiconsIcon icon={Key01Icon} data-icon='inline-start' />
            {t('Open API keys')}
          </Button>
          <Button
            variant='outline'
            render={
              <a
                href={CCSWITCH_RELEASES_URL}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <HugeiconsIcon icon={Download04Icon} data-icon='inline-start' />
            {t('Download CC Switch')}
          </Button>
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Imported settings')}</AlertTitle>
          <AlertDescription>
            {t(
              'The Codex import includes the selected API key, primary model, and service endpoint ending in /v1. Only approve the import on your own device.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='manual-config' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('2. Configure config.toml manually')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Codex reads user settings from the configuration file in your user directory.'
          )}
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <CodeBlock code={windowsConfigPath} label='Windows' />
          <CodeBlock code='~/.codex/config.toml' label='macOS / Linux' />
        </div>

        <h3 className='mt-8 text-lg font-semibold'>
          {t('Set the API key environment variable')}
        </h3>
        <p className='text-muted-foreground mt-2 leading-7'>
          {t(
            'Store the API key in a dedicated environment variable instead of writing the secret into config.toml.'
          )}
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <CodeBlock code={powershellApiKey} label='PowerShell' />
          <CodeBlock code={shellApiKey} label='macOS / Linux' />
        </div>

        <h3 className='mt-8 text-lg font-semibold'>{t('Edit config.toml')}</h3>
        <p className='text-muted-foreground mt-2 leading-7'>
          {t(
            'Keep any existing Codex settings and merge the provider block below. Replace the example model with one available to your API key when needed.'
          )}
        </p>
        <div className='mt-4'>
          <CodeBlock code={codexConfig} label='config.toml' />
        </div>

        <h3 className='mt-8 text-lg font-semibold'>
          {t('Restart and verify')}
        </h3>
        <NumberedSteps
          items={[
            t(
              'Save config.toml, then restart the terminal and any running Codex app or IDE extension.'
            ),
            t('Run codex in a new terminal to start a test task.'),
            t(
              'If startup fails, confirm the environment variable, model name, and base URL before retrying.'
            ),
          ]}
        />
        <div className='mt-5'>
          <CodeBlock code='codex' label={t('Terminal')} />
        </div>

        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Configuration notes')}</AlertTitle>
          <AlertDescription>
            <span>
              {t(
                'Keep wire_api set to responses and keep /v1 at the end of the base URL for this service.'
              )}
            </span>{' '}
            <a
              href={CODEX_CONFIG_REFERENCE_URL}
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground underline underline-offset-4'
            >
              {t('Codex configuration reference')}
            </a>
          </AlertDescription>
        </Alert>
      </section>
    </DocsShell>
  )
}
