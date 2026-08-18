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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Copy, Terminal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { IconBadge } from '@/components/ui/icon-badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildClaudeCodeSnippet,
  buildOpenCodeSnippet,
  formatGatewayApiKey,
  pickDefaultQuickSetupModel,
  resolveGatewayServerAddress,
  QUICK_SETUP_API_KEY_PLACEHOLDER,
  type ClaudeCodeSnippetFormat,
  type QuickSetupClient,
} from '@/features/dashboard/lib/quick-setup'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { getUserModels } from '@/lib/api'

import { PanelWrapper } from '../ui/panel-wrapper'

export function QuickSetupPanel() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: true })
  const [client, setClient] = useState<QuickSetupClient>('claude')
  const [claudeFormat, setClaudeFormat] =
    useState<ClaudeCodeSnippetFormat>('settings')
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [isCopyingKey, setIsCopyingKey] = useState(false)

  const keysQuery = useQuery({
    queryKey: ['overview-quick-setup-keys'],
    queryFn: () => getApiKeys({ p: 1, size: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  const modelsQuery = useQuery({
    queryKey: ['user-models'],
    queryFn: getUserModels,
    staleTime: 5 * 60 * 1000,
  })

  const enabledKeys = useMemo(
    () =>
      (keysQuery.data?.data?.items ?? []).filter(
        (item) => item.status === API_KEY_STATUS.ENABLED
      ),
    [keysQuery.data?.data?.items]
  )
  const models = modelsQuery.data?.data ?? []
  const keyOptions = useMemo(
    () =>
      enabledKeys.map((item) => ({
        value: String(item.id),
        label: item.name || `sk-…${item.id}`,
      })),
    [enabledKeys]
  )
  const modelOptions = useMemo(
    () =>
      (modelsQuery.data?.data ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    [modelsQuery.data?.data]
  )

  const firstEnabledKeyId = enabledKeys[0] ? String(enabledKeys[0].id) : ''
  const keyId = selectedKeyId || firstEnabledKeyId
  const model = selectedModel || pickDefaultQuickSetupModel(models)
  const keyIdNumber = Number(keyId)

  const baseUrl = resolveGatewayServerAddress(status)
  const apiKey = QUICK_SETUP_API_KEY_PLACEHOLDER
  const snippet =
    client === 'claude'
      ? buildClaudeCodeSnippet({
          baseUrl,
          apiKey,
          model,
          format: claudeFormat,
        })
      : buildOpenCodeSnippet({ baseUrl, apiKey, model })
  const canCopy =
    Number.isFinite(keyIdNumber) &&
    keyIdNumber > 0 &&
    Boolean(model) &&
    Boolean(baseUrl)
  const isCopied = Boolean(copiedText) && !isCopyingKey
  let snippetLabel = '~/.claude/settings.json'
  if (client === 'opencode') {
    snippetLabel = '~/.config/opencode/opencode.json'
  } else if (claudeFormat === 'shell') {
    snippetLabel = t('Shell')
  }

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <IconBadge tone='primary' size='sm'>
            <Terminal />
          </IconBadge>
          {t('Quick setup')}
        </span>
      }
      description={t('Point Claude Code or OpenCode at this gateway')}
    >
      <div className='flex flex-col gap-4'>
        <Tabs
          value={client}
          onValueChange={(value) => setClient(value as QuickSetupClient)}
        >
          <TabsList>
            <TabsTrigger value='claude'>Claude Code</TabsTrigger>
            <TabsTrigger value='opencode'>OpenCode</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='min-w-0 space-y-2'>
            <Label htmlFor='overview-quick-setup-key'>{t('API Key')}</Label>
            <ComboboxInput
              id='overview-quick-setup-key'
              options={keyOptions}
              value={keyId}
              onValueChange={setSelectedKeyId}
              placeholder={t('Select an API key')}
              emptyText={t('No API Keys Found')}
            />
            {enabledKeys.length === 0 && !keysQuery.isLoading ? (
              <p className='text-muted-foreground text-xs'>
                {t('No API keys yet. Create one to generate setup commands.')}{' '}
                <Button
                  variant='link'
                  className='h-auto p-0 text-xs'
                  render={<Link to='/keys' />}
                >
                  {t('Create API Key')}
                </Button>
              </p>
            ) : null}
          </div>
          <div className='min-w-0 space-y-2'>
            <Label htmlFor='overview-quick-setup-model'>{t('Model')}</Label>
            <ComboboxInput
              id='overview-quick-setup-model'
              options={modelOptions}
              value={model}
              onValueChange={setSelectedModel}
              placeholder={t('Select or enter model name')}
              emptyText={t('No models found')}
              allowCustomValue
            />
          </div>
        </div>

        {client === 'claude' ? (
          <p className='text-muted-foreground text-xs'>
            {t(
              'Selected model is used for Claude Code aliases (Haiku, Sonnet, Opus, and Fable).'
            )}
          </p>
        ) : null}

        <div className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-muted-foreground font-mono text-xs'>
              {snippetLabel}
            </span>
            <div className='flex items-center gap-2'>
              {client === 'claude' ? (
                <Tabs
                  value={claudeFormat}
                  onValueChange={(value) =>
                    setClaudeFormat(value as ClaudeCodeSnippetFormat)
                  }
                >
                  <TabsList className='h-8'>
                    <TabsTrigger value='settings' className='text-xs'>
                      {t('Settings file')}
                    </TabsTrigger>
                    <TabsTrigger value='shell' className='text-xs'>
                      {t('Shell')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='gap-1.5'
                disabled={!canCopy || isCopyingKey}
                onClick={() => {
                  void (async () => {
                    setIsCopyingKey(true)
                    try {
                      const result = await fetchTokenKey(keyIdNumber)
                      const realKey = formatGatewayApiKey(
                        result.data?.key ?? ''
                      )
                      if (!realKey) {
                        return
                      }
                      const realSnippet =
                        client === 'claude'
                          ? buildClaudeCodeSnippet({
                              baseUrl,
                              apiKey: realKey,
                              model,
                              format: claudeFormat,
                            })
                          : buildOpenCodeSnippet({
                              baseUrl,
                              apiKey: realKey,
                              model,
                            })
                      await copyToClipboard(realSnippet)
                    } finally {
                      setIsCopyingKey(false)
                    }
                  })()
                }}
              >
                {isCopied ? <Check className='text-success' /> : <Copy />}
                {isCopied ? t('Copied!') : t('Copy')}
              </Button>
            </div>
          </div>
          <div className='overflow-x-auto rounded-lg border bg-muted/40'>
            <pre className='p-3 font-mono text-xs leading-relaxed whitespace-pre'>
              {snippet}
            </pre>
          </div>
          <p className='text-muted-foreground text-xs'>
            {client === 'claude'
              ? t('Paste into ~/.claude/settings.json, then run claude.')
              : t(
                  'Save as ~/.config/opencode/opencode.json, then run opencode.'
                )}
          </p>
        </div>
      </div>
    </PanelWrapper>
  )
}
