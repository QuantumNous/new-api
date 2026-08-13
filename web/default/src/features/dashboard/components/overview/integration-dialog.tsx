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
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OFFICIAL_WEBSITE_ORIGIN } from '@/lib/origins'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/copy-button'
import type { ApiKey } from '@/features/keys/types'
import { ApiKeyPicker } from './api-key-picker'
import { useIntegrationCards } from './integration-cards'
import {
  buildAgentInstallCommand,
  buildApiSnippet,
  buildSdkSnippet,
  detectAgentPlatform,
  getSnippetCopyValue,
  CLI_INSTALL_COMMAND,
  CLI_LOGIN_COMMAND,
  type AgentPlatform,
  type ApiLanguage,
  type IntegrationId,
  type SnippetContext,
} from './integration-snippets'

function CodeBlock(props: { code: string; copyValue?: string }) {
  const { t } = useTranslation()

  return (
    <div className='group relative'>
      {props.copyValue === undefined ? (
        <Loader2
          className='text-muted-foreground absolute top-3.5 right-3.5 z-1 size-3.5 animate-spin'
          aria-label={t('Loading...')}
        />
      ) : (
        <CopyButton
          value={props.copyValue}
          variant='secondary'
          size='icon'
          className='absolute top-2 right-2 z-1 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
          iconClassName='size-3.5'
          tooltip={t('Copy code')}
          successTooltip={t('Copied!')}
          aria-label={t('Copy code')}
        />
      )}
      {/* Wrap instead of scrolling horizontally: the whole command should be
          readable in place, and long curl lines otherwise hide their tail. */}
      <pre className='bg-foreground/[0.04] rounded-xl border p-4 pr-11 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'>
        {props.code}
      </pre>
    </div>
  )
}

function StepLabel(props: { children: string }) {
  return <div className='text-sm font-semibold'>{props.children}</div>
}

function ModelSelect(props: {
  models: string[]
  value: string
  onChange: (model: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='flex min-w-0 items-center gap-2'>
      <span className='text-muted-foreground shrink-0 text-xs font-medium'>
        {t('Model')}
      </span>
      <Select
        value={props.value}
        onValueChange={(value) => {
          if (typeof value === 'string' && value) props.onChange(value)
        }}
      >
        <SelectTrigger
          size='sm'
          className='max-w-64 min-w-0 text-xs'
          disabled={props.models.length === 0}
          aria-label={t('Model')}
        >
          <SelectValue className='truncate'>
            {props.models.length === 0 ? t('Loading') : props.value}
          </SelectValue>
        </SelectTrigger>
        {/* Size to the longest model id instead of the trigger, so vendor-
            prefixed names are not clipped under the check indicator. */}
        <SelectContent
          alignItemWithTrigger={false}
          className='w-auto max-w-[min(28rem,calc(100vw-3rem))] min-w-(--anchor-width)'
        >
          <SelectGroup>
            {props.models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export interface IntegrationDialogProps {
  integrationId: IntegrationId | null
  onOpenChange: (open: boolean) => void
  keys: ApiKey[]
  keysLoading: boolean
  selectedKeyId: number | null
  resolvedKeys: Record<number, string>
  onSelectKey: (keyId: number) => void
  models: string[]
  selectedModel: string
  onSelectModel: (model: string) => void
  snippetContext: SnippetContext
}

export function IntegrationDialog(props: IntegrationDialogProps) {
  const { t } = useTranslation()
  const cards = useIntegrationCards()
  const [apiLanguage, setApiLanguage] = useState<ApiLanguage>('curl')
  const [sdkLanguage, setSdkLanguage] = useState<ApiLanguage>('curl')
  const [agentPlatform, setAgentPlatform] = useState<AgentPlatform>(() =>
    detectAgentPlatform(
      typeof navigator === 'undefined' ? '' : navigator.userAgent
    )
  )

  const card = cards.find((item) => item.id === props.integrationId)
  const maskedKey = props.snippetContext.apiKey
  const realKey =
    props.selectedKeyId === null
      ? undefined
      : props.resolvedKeys[props.selectedKeyId]

  // Samples render the masked key but copy the real one, matching how the key
  // list behaves elsewhere in the console. Copying stays disabled until the real
  // key arrives, so nobody walks away with an unusable masked snippet.
  const renderCode = (code: string) => {
    return (
      <CodeBlock
        code={code}
        copyValue={getSnippetCopyValue(
          code,
          maskedKey,
          props.selectedKeyId,
          realKey
        )}
      />
    )
  }

  const keyStep = (
    <div className='flex flex-col gap-2'>
      <StepLabel>{t('Step 1 · Choose an API key')}</StepLabel>
      <ApiKeyPicker
        keys={props.keys}
        loading={props.keysLoading}
        selectedKeyId={props.selectedKeyId}
        resolvedKeys={props.resolvedKeys}
        onSelect={props.onSelectKey}
      />
    </div>
  )

  return (
    <Dialog
      open={props.integrationId !== null}
      onOpenChange={props.onOpenChange}
    >
      {/* DialogContent is a grid; without min-w-0 the code block's intrinsic
          width would push content past the popup's rounded edge. */}
      <DialogContent className='max-h-[90vh] gap-5 overflow-y-auto sm:max-w-3xl [&>*]:min-w-0'>
        <DialogHeader>
          <DialogTitle>{card?.title ?? ''}</DialogTitle>
          <DialogDescription>{card?.description ?? ''}</DialogDescription>
        </DialogHeader>

        {props.integrationId === 'api' && (
          <div className='flex flex-col gap-5'>
            {keyStep}
            <div className='flex flex-col gap-3'>
              <StepLabel>{t('Step 2 · Copy a ready-to-run request')}</StepLabel>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <Tabs
                  value={apiLanguage}
                  onValueChange={(value) =>
                    setApiLanguage(value as ApiLanguage)
                  }
                >
                  <TabsList>
                    <TabsTrigger value='curl'>cURL</TabsTrigger>
                    <TabsTrigger value='node'>Node.js</TabsTrigger>
                    <TabsTrigger value='python'>Python</TabsTrigger>
                  </TabsList>
                </Tabs>
                <ModelSelect
                  models={props.models}
                  value={props.selectedModel}
                  onChange={props.onSelectModel}
                />
              </div>
              {renderCode(buildApiSnippet(apiLanguage, props.snippetContext))}
            </div>
          </div>
        )}

        {props.integrationId === 'sdk' && (
          <div className='flex flex-col gap-5'>
            {keyStep}
            <div className='flex flex-col gap-3'>
              <StepLabel>{t('Step 2 · Copy the SDK setup')}</StepLabel>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <Tabs
                  value={sdkLanguage}
                  onValueChange={(value) =>
                    setSdkLanguage(value as ApiLanguage)
                  }
                >
                  <TabsList>
                    <TabsTrigger value='curl'>cURL</TabsTrigger>
                    <TabsTrigger value='node'>Node.js</TabsTrigger>
                    <TabsTrigger value='python'>Python</TabsTrigger>
                  </TabsList>
                </Tabs>
                <ModelSelect
                  models={props.models}
                  value={props.selectedModel}
                  onChange={props.onSelectModel}
                />
              </div>
              {renderCode(buildSdkSnippet(sdkLanguage, props.snippetContext))}
            </div>
          </div>
        )}

        {props.integrationId === 'cli' && (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <StepLabel>{t('Step 1 · Install the CLI')}</StepLabel>
              {renderCode(CLI_INSTALL_COMMAND)}
            </div>
            <div className='flex flex-col gap-2'>
              <StepLabel>{t('Step 2 · Sign in')}</StepLabel>
              {renderCode(CLI_LOGIN_COMMAND)}
            </div>
            <div className='flex flex-col gap-2'>
              <StepLabel>{t('Step 3 · Start creating')}</StepLabel>
              <p className='text-muted-foreground text-sm'>
                {t('Tell your AI assistant what you want to make.')}
              </p>
              {renderCode(
                t('Use Flatkey CLI to generate a "beautiful sunrise" picture.')
              )}
            </div>
          </div>
        )}

        {props.integrationId === 'agent' && (
          <div className='flex flex-col gap-5'>
            {keyStep}
            <div className='flex flex-col gap-3'>
              <StepLabel>
                {t('Step 2 · Install Flatkey for your system')}
              </StepLabel>
              <Tabs
                value={agentPlatform}
                onValueChange={(value) =>
                  setAgentPlatform(value as AgentPlatform)
                }
              >
                <TabsList>
                  <TabsTrigger value='mac'>macOS</TabsTrigger>
                  <TabsTrigger value='linux'>Linux</TabsTrigger>
                  <TabsTrigger value='windows'>Windows</TabsTrigger>
                </TabsList>
              </Tabs>
              {renderCode(
                buildAgentInstallCommand(
                  agentPlatform,
                  OFFICIAL_WEBSITE_ORIGIN || window.location.origin
                )
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
