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
import { Download, ShieldCheck, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AGENTS } from '../constants'
import {
  buildUnixSetupCommand,
  buildWindowsSetupCommand,
  SETUP_GATEWAY_URL,
  SETUP_PROVIDER_NAME,
} from '../lib/agent-setup'
import { AgentIcon } from './agent-icon'
import { DocsSection } from './docs-section'

function SetupSteps() {
  const { t } = useTranslation()

  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className='bg-muted/30 rounded-lg border p-4'>
        <div className='text-muted-foreground mb-1 font-mono text-[11px] font-semibold tracking-wider uppercase'>
          {t('Step 1')}
        </div>
        <p className='font-medium'>{t('Choose an agent')}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-5'>
          {t(
            'Select Claude Code, Codex CLI, Gemini CLI, or DeepSeek Harness in the script menu.'
          )}
        </p>
      </div>
      <div className='bg-muted/30 rounded-lg border p-4'>
        <div className='text-muted-foreground mb-1 font-mono text-[11px] font-semibold tracking-wider uppercase'>
          {t('Step 2')}
        </div>
        <p className='font-medium'>{t('Paste an API key')}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-5'>
          {t(
            'The key is hidden while you type and is written only to the selected client configuration.'
          )}
        </p>
      </div>
    </div>
  )
}

function AgentTargets(props: { platform: 'windows' | 'unix' }) {
  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      {AGENTS.map((agent) => (
        <div
          key={agent.id}
          className='border-border/60 bg-background/60 flex items-center gap-2 rounded-lg border px-3 py-2.5'
        >
          <AgentIcon agent={agent.id} size={20} />
          <div className='min-w-0'>
            <div className='text-sm font-medium'>{agent.name}</div>
            <div className='text-muted-foreground truncate font-mono text-[11px]'>
              {agent.configPaths[props.platform]}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SecurityNotice() {
  const { t } = useTranslation()

  return (
    <div className='border-success/20 bg-success/5 text-muted-foreground flex gap-3 rounded-lg border p-4 text-sm leading-6'>
      <ShieldCheck
        aria-hidden='true'
        className='text-success mt-0.5 size-4 shrink-0'
      />
      <div className='space-y-1'>
        <p>
          {t(
            'Existing configuration is backed up before writing. The script does not install the client itself.'
          )}
        </p>
        <p>
          {t(
            'The API key is stored in plain text in the selected client configuration. Use a dedicated key and revoke it if the file is exposed.'
          )}
        </p>
      </div>
    </div>
  )
}

export function OneClickSetupSection() {
  const { t } = useTranslation()
  const windowsCommand = buildWindowsSetupCommand()
  const unixCommand = buildUnixSetupCommand()

  return (
    <DocsSection
      id='one-click-setup'
      title={t('One-click setup')}
      description={t(
        'Run one command in your terminal. The script downloads from this site, asks which client to configure, then prompts for an API key without showing it on screen.'
      )}
    >
      <Card className='gap-0 overflow-hidden'>
        <CardHeader className='border-border/60 border-b'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge>{SETUP_PROVIDER_NAME}</Badge>
            <Badge variant='secondary'>{t('Windows')}</Badge>
            <Badge variant='secondary'>{t('macOS / Linux')}</Badge>
            <Badge variant='outline'>
              {t('No administrator rights required')}
            </Badge>
          </div>
          <code className='text-muted-foreground font-mono text-xs'>
            {SETUP_GATEWAY_URL}
          </code>
          <CardTitle className='mt-2 flex items-center gap-2 text-lg'>
            <Terminal aria-hidden='true' className='text-primary size-5' />
            {t('Remote setup command')}
          </CardTitle>
          <CardDescription>
            {t(
              'Choose your operating system, copy the command, and run it in the matching terminal.'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-5 pt-4'>
          <SetupSteps />

          <Tabs defaultValue='windows' className='gap-4'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='windows'>{t('Windows')}</TabsTrigger>
              <TabsTrigger value='unix'>{t('macOS / Linux')}</TabsTrigger>
            </TabsList>

            <TabsContent value='windows' className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='outline'>{t('PowerShell 5.1 or later')}</Badge>
                <Badge variant='outline'>{t('Chinese prompts')}</Badge>
              </div>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'The script uses the fixed NekoAI gateway address. Copy this command into a PowerShell window and press Enter.'
                )}
              </p>
              <CodeBlock
                code={windowsCommand}
                language='powershell'
                title={t('PowerShell')}
                showToolbar
                enableCollapse={false}
              >
                <CodeBlockCopyButton />
              </CodeBlock>
              <Button
                variant='outline'
                render={
                  <a
                    href={`${SETUP_GATEWAY_URL}/agent-setup.bat`}
                    download='agent-setup.bat'
                  />
                }
              >
                <Download aria-hidden='true' />
                {t('Download .bat')}
              </Button>
              <AgentTargets platform='windows' />
            </TabsContent>

            <TabsContent value='unix' className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='outline'>{t('Python 3')}</Badge>
                <Badge variant='outline'>{t('curl')}</Badge>
              </div>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'The script uses the fixed NekoAI gateway address. Copy it into Terminal and press Enter. The temporary script is removed afterwards.'
                )}
              </p>
              <CodeBlock
                code={unixCommand}
                language='bash'
                title={t('Terminal')}
                showToolbar
                enableCollapse={false}
              >
                <CodeBlockCopyButton />
              </CodeBlock>
              <Button
                variant='outline'
                render={
                  <a
                    href={`${SETUP_GATEWAY_URL}/agent-setup.sh`}
                    download='agent-setup.sh'
                  />
                }
              >
                <Download aria-hidden='true' />
                {t('Download .sh')}
              </Button>
              <AgentTargets platform='unix' />
            </TabsContent>
          </Tabs>

          <p className='text-muted-foreground text-xs leading-5'>
            {t(
              'If you download the script, run it from a terminal. It uses the fixed NekoAI gateway address.'
            )}
          </p>
          <SecurityNotice />
        </CardContent>
      </Card>
    </DocsSection>
  )
}
