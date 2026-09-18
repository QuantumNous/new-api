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
import { Wand2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import {
  FloatingWindow,
  type FloatingWindowPosition,
} from '@/components/floating-window'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import type { ModelNamingSuggestion } from '../lib'
import {
  ModelMappingEditor,
  type ModelMappingDraftRequest,
} from './model-mapping-editor'

type ModelRedirectPanelProps = {
  defaultPosition: FloatingWindowPosition
  width: number
  onClose: () => void
  mappingCount: number
  mappingValue: string
  onMappingChange: (value: string) => void
  /** Called once an edit settles; the drawer syncs the model list here. */
  onMappingCommit: (value: string) => void
  suggestions: ModelNamingSuggestion[]
  onApplySuggestion: (suggestion: ModelNamingSuggestion) => void
  onOpenRules: () => void
  syncModels: boolean
  onSyncModelsChange: (value: boolean) => void
  sourceModelOptions: string[]
  targetModelOptions: string[]
  draftRequest: ModelMappingDraftRequest | null
  onDraftRequestHandled: () => void
  disabled?: boolean
}

/**
 * Floating workbench for model redirects. It is mounted inside the channel
 * drawer so the modal sheet treats it as its own content, and floats above
 * the page from there.
 */
export function ModelRedirectPanel(props: ModelRedirectPanelProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    <FloatingWindow
      title={t('Model redirects')}
      badge={
        <Badge variant='secondary' className='h-4 px-1 text-[10px]'>
          {props.mappingCount}
        </Badge>
      }
      defaultPosition={props.defaultPosition}
      defaultWidth={props.width}
      minWidth={340}
      storageKey='channel-model-redirects'
      onClose={props.onClose}
      footer={
        <div className='flex items-start gap-3'>
          <Checkbox
            id={`${id}-sync`}
            className='mt-0.5'
            checked={props.syncModels}
            onCheckedChange={(checked) =>
              props.onSyncModelsChange(checked === true)
            }
          />
          <Label
            htmlFor={`${id}-sync`}
            className='text-xs leading-5 font-normal'
          >
            {t(
              'Publish the request names and remove the raw upstream names from the model list'
            )}
          </Label>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          {props.suggestions.length > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('Suggested rules')}
            </p>
          )}
          <div className='flex flex-wrap items-center gap-2'>
            {props.suggestions.map((suggestion) => {
              let label = ''
              if (suggestion.rule.type === 'replace') {
                label = t('Replace {{find}} with {{replaceWith}}', {
                  find: suggestion.rule.find,
                  replaceWith: suggestion.rule.replaceWith,
                })
              } else if ('values' in suggestion.rule) {
                label = t('Strip {{affix}}', {
                  affix: suggestion.rule.values,
                })
              }
              return (
                <Button
                  key={suggestion.id}
                  type='button'
                  variant='secondary'
                  size='xs'
                  disabled={props.disabled}
                  onClick={() => props.onApplySuggestion(suggestion)}
                >
                  <Wand2 aria-hidden='true' />
                  {label}
                  <Badge variant='outline' className='h-4 px-1 text-[10px]'>
                    {suggestion.models.length}
                  </Badge>
                </Button>
              )
            })}
            <Button
              type='button'
              variant='ghost'
              size='xs'
              disabled={props.disabled}
              onClick={props.onOpenRules}
            >
              {t('More rules')}
            </Button>
          </div>
        </div>
        <ModelMappingEditor
          value={props.mappingValue}
          onChange={props.onMappingChange}
          onCommit={props.onMappingCommit}
          disabled={props.disabled}
          sourceModelOptions={props.sourceModelOptions}
          targetModelOptions={props.targetModelOptions}
          draftRequest={props.draftRequest}
          onDraftRequestHandled={props.onDraftRequestHandled}
        />
      </div>
    </FloatingWindow>
  )
}
