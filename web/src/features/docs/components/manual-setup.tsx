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
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AGENTS, type AgentId } from '../constants'
import {
  buildClaudeSettings,
  buildCodexConfig,
  buildDshConfig,
  buildDshCredentials,
  buildGeminiEnv,
  buildGeminiSettings,
} from '../lib/agent-setup'
import { AgentIcon } from './agent-icon'
import { DocsSection } from './docs-section'

function AgentHeader(props: {
  agent: AgentId
  name: string
  paths: { windows: string; unix: string }
}) {
  const { t } = useTranslation()

  return (
    <div className='flex min-w-0 items-start gap-3'>
      <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
        <AgentIcon agent={props.agent} size={20} />
      </div>
      <div className='min-w-0 space-y-1'>
        <CardTitle className='text-base'>{props.name}</CardTitle>
        <div className='text-muted-foreground min-w-0 space-y-0.5 text-[11px] leading-5'>
          <div className='flex min-w-0 items-baseline gap-1.5'>
            <span className='shrink-0'>{t('Windows')}</span>
            <code className='truncate font-mono'>{props.paths.windows}</code>
          </div>
          <div className='flex min-w-0 items-baseline gap-1.5'>
            <span className='shrink-0'>{t('macOS / Linux')}</span>
            <code className='truncate font-mono'>{props.paths.unix}</code>
          </div>
        </div>
      </div>
    </div>
  )
}

function ManualBlock(props: { code: string; language: string; title: string }) {
  return (
    <CodeBlock
      code={props.code}
      language={props.language}
      title={props.title}
      showToolbar
      enableCollapse={false}
    >
      <CodeBlockCopyButton />
    </CodeBlock>
  )
}

export function ManualSetupSection(props: { gatewayUrl: string }) {
  const { t } = useTranslation()
  const claude = buildClaudeSettings(props.gatewayUrl)
  const codex = buildCodexConfig(props.gatewayUrl)
  const dshConfig = buildDshConfig(props.gatewayUrl)
  const dshCredentials = buildDshCredentials()
  const geminiEnv = buildGeminiEnv(props.gatewayUrl)
  const geminiSettings = buildGeminiSettings()

  return (
    <DocsSection
      id='manual-setup'
      title={t('Manual configuration')}
      description={t(
        'Prefer editing files yourself? Choose a client tab and use the matching configuration. Replace the key placeholder with your own API key.'
      )}
    >
      <Tabs defaultValue={AGENTS[0].id} className='gap-4'>
        <TabsList className='grid w-full grid-cols-4 group-data-horizontal/tabs:h-auto'>
          {AGENTS.map((agent) => (
            <TabsTrigger key={agent.id} value={agent.id} className='gap-2 py-2'>
              <AgentIcon agent={agent.id} size={16} />
              <span className='hidden sm:inline'>{agent.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value='claude-code'>
          <Card>
            <CardHeader>
              <AgentHeader
                agent='claude-code'
                name='Claude Code'
                paths={AGENTS[0].configPaths}
              />
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'Add these values to the existing settings file. Claude Code uses the gateway root as its Anthropic base URL.'
                )}
              </p>
              <ManualBlock
                code={claude}
                language='json'
                title='settings.json'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='codex-cli'>
          <Card>
            <CardHeader>
              <AgentHeader
                agent='codex-cli'
                name='Codex CLI'
                paths={AGENTS[1].configPaths}
              />
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'Keep your existing MCP and project sections. Only the provider fields below need to change.'
                )}
              </p>
              <ManualBlock code={codex} language='toml' title='config.toml' />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='gemini-cli'>
          <Card>
            <CardHeader>
              <div className='flex flex-wrap items-center gap-2'>
                <AgentHeader
                  agent='gemini-cli'
                  name='Gemini CLI'
                  paths={AGENTS[2].configPaths}
                />
                <Badge variant='outline'>{t('Two files')}</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm leading-6'>
                  {t(
                    'Set the API key and gateway root in .env. Gemini CLI appends the Gemini API route itself.'
                  )}
                </p>
                <ManualBlock code={geminiEnv} language='bash' title='.env' />
              </div>
              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm leading-6'>
                  {t(
                    'Select API-key authentication and the default model in settings.json.'
                  )}
                </p>
                <ManualBlock
                  code={geminiSettings}
                  language='json'
                  title='settings.json'
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='deepseek-harness'>
          <Card>
            <CardHeader>
              <div className='flex flex-wrap items-center gap-2'>
                <AgentHeader
                  agent='deepseek-harness'
                  name='DeepSeek Harness'
                  paths={AGENTS[3].configPaths}
                />
                <Badge variant='outline'>{t('Two files')}</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'Merge this provider under the existing llm-pi-ai providers map, then set the default model. Do not replace other providers.'
                )}
              </p>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'The one-click script updates the web and desktop profiles, plus headless and acp when they already exist. In headless, it also re-enables the managed credential store.'
                )}
              </p>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'DSH applies a home-level cordis.patch.yml after profiles. If that file defines an llm-pi-ai config, remove it before setup because it overrides this provider.'
                )}
              </p>
              <ManualBlock
                code={dshConfig}
                language='yaml'
                title='cordis.patch.yml'
              />
              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm leading-6'>
                  {t(
                    'Store the API key as a credential reference in the DSH home directory.'
                  )}
                </p>
                <ManualBlock
                  code={dshCredentials}
                  language='yaml'
                  title='.credentials.yaml'
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DocsSection>
  )
}
