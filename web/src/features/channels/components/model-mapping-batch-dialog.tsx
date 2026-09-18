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
import { ArrowRight } from 'lucide-react'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  deriveModelMappingPairs,
  type ModelMappingDirection,
  type ModelMappingPair,
  type ModelMappingRule,
} from '../lib'
import { UpstreamModelSelection } from './upstream-model-selection'

const PREVIEW_LIMIT = 8

/** Where the selectable names come from. */
export type ModelMappingBatchSource = 'upstream' | 'channel'

export type ModelMappingBatchResult = {
  pairs: ModelMappingPair[]
  /** Publish the request names and drop the raw upstream names from the model list. */
  syncModels: boolean
}

type RuleType = ModelMappingRule['type']

type ModelMappingBatchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names returned by the provider's model list; enables the upstream source. */
  upstreamModels?: string[]
  channelModels: string[]
  initialSource?: ModelMappingBatchSource
  initialSelected?: string[]
  onApply: (result: ModelMappingBatchResult) => void
}

export function ModelMappingBatchDialog(props: ModelMappingBatchDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const upstreamModels = props.upstreamModels ?? []
  const hasUpstream = upstreamModels.length > 0
  const [source, setSource] = useState<ModelMappingBatchSource>(
    () => props.initialSource ?? (hasUpstream ? 'upstream' : 'channel')
  )
  const [selected, setSelected] = useState<string[]>(
    props.initialSelected ?? []
  )
  const [direction, setDirection] = useState<ModelMappingDirection>(
    source === 'upstream' ? 'upstream' : 'request'
  )
  const [ruleType, setRuleType] = useState<RuleType>(
    direction === 'upstream' ? 'strip-suffix' : 'add-suffix'
  )
  const [stripPrefixes, setStripPrefixes] = useState('')
  const [stripSuffixes, setStripSuffixes] = useState('')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [find, setFind] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [syncModels, setSyncModels] = useState(true)

  const candidates =
    source === 'upstream' ? upstreamModels : props.channelModels
  const rule = useMemo<ModelMappingRule>(() => {
    if (ruleType === 'strip-prefix') {
      return { type: 'strip-prefix', values: stripPrefixes }
    }
    if (ruleType === 'strip-suffix') {
      return { type: 'strip-suffix', values: stripSuffixes }
    }
    if (ruleType === 'add-prefix') return { type: 'add-prefix', value: prefix }
    if (ruleType === 'add-suffix') return { type: 'add-suffix', value: suffix }
    return { type: 'replace', find, replaceWith }
  }, [
    ruleType,
    stripPrefixes,
    stripSuffixes,
    prefix,
    suffix,
    find,
    replaceWith,
  ])
  const derivation = useMemo(
    () => deriveModelMappingPairs(selected, direction, rule),
    [selected, direction, rule]
  )
  const preview = derivation.pairs.slice(0, PREVIEW_LIMIT)
  const remaining = derivation.pairs.length - preview.length

  const changeDirection = (next: ModelMappingDirection) => {
    setDirection(next)
    setRuleType(next === 'upstream' ? 'strip-suffix' : 'add-suffix')
  }

  const changeSource = (next: ModelMappingBatchSource) => {
    setSource(next)
    setSelected([])
    changeDirection(next === 'upstream' ? 'upstream' : 'request')
  }

  const replaceControls = (
    <div className='grid gap-2 sm:grid-cols-2'>
      <Input
        aria-label={t('Find')}
        placeholder='.'
        value={find}
        onChange={(event) => setFind(event.target.value)}
        disabled={ruleType !== 'replace'}
      />
      <Input
        aria-label={t('Replace with')}
        placeholder='-'
        value={replaceWith}
        onChange={(event) => setReplaceWith(event.target.value)}
        disabled={ruleType !== 'replace'}
      />
    </div>
  )
  const affixHint = t('Separate several values with commas')
  let ruleOptions: Array<{
    type: RuleType
    label: string
    control: ReactNode
    hint?: string
  }>
  if (direction === 'upstream') {
    ruleOptions = [
      {
        type: 'strip-suffix',
        label: t('Strip suffix'),
        hint: affixHint,
        control: (
          <Input
            aria-label={t('Suffix')}
            placeholder='-all, -latest'
            value={stripSuffixes}
            onChange={(event) => setStripSuffixes(event.target.value)}
            disabled={ruleType !== 'strip-suffix'}
          />
        ),
      },
      {
        type: 'strip-prefix',
        label: t('Strip prefix'),
        hint: affixHint,
        control: (
          <Input
            aria-label={t('Prefix')}
            placeholder='openai/, anthropic/'
            value={stripPrefixes}
            onChange={(event) => setStripPrefixes(event.target.value)}
            disabled={ruleType !== 'strip-prefix'}
          />
        ),
      },
      { type: 'replace', label: t('Replace text'), control: replaceControls },
    ]
  } else {
    ruleOptions = [
      {
        type: 'add-suffix',
        label: t('Add suffix'),
        control: (
          <Input
            aria-label={t('Suffix')}
            placeholder='-all'
            value={suffix}
            onChange={(event) => setSuffix(event.target.value)}
            disabled={ruleType !== 'add-suffix'}
          />
        ),
      },
      {
        type: 'add-prefix',
        label: t('Add prefix'),
        control: (
          <Input
            aria-label={t('Prefix')}
            placeholder='openai/'
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            disabled={ruleType !== 'add-prefix'}
          />
        ),
      },
      { type: 'replace', label: t('Replace text'), control: replaceControls },
    ]
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Batch add mappings')}
      description={t(
        'Pick models and derive the other side with a rule to create request-to-upstream mappings.'
      )}
      contentClassName='sm:max-w-4xl'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={derivation.pairs.length === 0}
            onClick={() => {
              props.onApply({
                pairs: derivation.pairs,
                syncModels: direction === 'upstream' && syncModels,
              })
              props.onOpenChange(false)
            }}
          >
            {t('Add {{count}} mapping(s)', { count: derivation.pairs.length })}
          </Button>
        </>
      }
    >
      <div className='grid gap-6 lg:grid-cols-2'>
        <section aria-labelledby={`${id}-models`} className='min-w-0 space-y-3'>
          <h3 id={`${id}-models`} className='text-sm font-semibold'>
            {t('Select models')}
          </h3>
          {hasUpstream && (
            <Tabs
              value={source}
              onValueChange={(value) =>
                changeSource(value === 'channel' ? 'channel' : 'upstream')
              }
            >
              <TabsList variant='line' aria-label={t('Select models')}>
                <TabsTrigger value='upstream'>
                  {t('Upstream model list')} ({upstreamModels.length})
                </TabsTrigger>
                <TabsTrigger value='channel'>
                  {t('Channel models')} ({props.channelModels.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <UpstreamModelSelection
            key={source}
            models={candidates}
            selected={selected}
            existingModels={candidates}
            onChange={setSelected}
            showChanges={false}
            summaryText={
              source === 'channel'
                ? t('Current models: {{count}}', { count: candidates.length })
                : undefined
            }
          />
        </section>
        <div className='min-w-0 space-y-5'>
          <section aria-labelledby={`${id}-direction`} className='space-y-2'>
            <h3 id={`${id}-direction`} className='text-sm font-semibold'>
              {t('Selected names are')}
            </h3>
            <RadioGroup
              value={direction}
              aria-labelledby={`${id}-direction`}
              onValueChange={(value) => {
                if (value === 'upstream' || value === 'request') {
                  changeDirection(value)
                }
              }}
              className='gap-2'
            >
              <div className='flex items-start gap-3'>
                <RadioGroupItem
                  value='upstream'
                  id={`${id}-direction-upstream`}
                  className='mt-0.5'
                />
                <div className='min-w-0 space-y-0.5'>
                  <Label
                    htmlFor={`${id}-direction-upstream`}
                    className='font-normal'
                  >
                    {t('Upstream names returned by the provider')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t('Derives the request names your users call')}
                  </p>
                </div>
              </div>
              <div className='flex items-start gap-3'>
                <RadioGroupItem
                  value='request'
                  id={`${id}-direction-request`}
                  className='mt-0.5'
                />
                <div className='min-w-0 space-y-0.5'>
                  <Label
                    htmlFor={`${id}-direction-request`}
                    className='font-normal'
                  >
                    {t('Request names your users call')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t('Derives the upstream names sent to the provider')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </section>
          <section aria-labelledby={`${id}-rule`} className='space-y-3'>
            <h3 id={`${id}-rule`} className='text-sm font-semibold'>
              {t('Rule')}
            </h3>
            <RadioGroup
              value={ruleType}
              aria-labelledby={`${id}-rule`}
              onValueChange={(value) => {
                const option = ruleOptions.find((item) => item.type === value)
                if (option) setRuleType(option.type)
              }}
              className='gap-3'
            >
              {ruleOptions.map((option) => (
                <div key={option.type} className='flex items-start gap-3'>
                  <RadioGroupItem
                    value={option.type}
                    id={`${id}-rule-${option.type}`}
                    className='mt-2'
                  />
                  <div className='min-w-0 flex-1 space-y-2'>
                    <Label
                      htmlFor={`${id}-rule-${option.type}`}
                      className='font-normal'
                    >
                      {option.label}
                    </Label>
                    {option.control}
                    {option.hint && ruleType === option.type && (
                      <p className='text-muted-foreground text-xs'>
                        {option.hint}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </section>
          {direction === 'upstream' && (
            <div className='flex items-start gap-3 rounded-md border p-3'>
              <Checkbox
                id={`${id}-sync`}
                className='mt-0.5'
                checked={syncModels}
                onCheckedChange={(checked) => setSyncModels(checked === true)}
              />
              <Label htmlFor={`${id}-sync`} className='leading-5 font-normal'>
                {t(
                  'Publish the request names and remove the raw upstream names from the model list'
                )}
              </Label>
            </div>
          )}
          <section aria-labelledby={`${id}-preview`} className='space-y-2'>
            <h3 id={`${id}-preview`} className='text-sm font-semibold'>
              {t('Preview')}
            </h3>
            {selected.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                {t('Select at least one model to preview mappings.')}
              </p>
            )}
            {derivation.pairs.length > 0 && (
              <div className='rounded-md border p-3 font-mono text-xs'>
                <div className='text-muted-foreground mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 font-sans'>
                  <span>{t('Request Model Name')}</span>
                  <span className='w-3.5' />
                  <span>{t('Upstream Model Name')}</span>
                </div>
                <ul
                  aria-label={t('Preview')}
                  className='max-h-56 space-y-1 overflow-y-auto'
                >
                  {preview.map((pair) => (
                    <li
                      key={pair.to}
                      className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2'
                    >
                      <span className='min-w-0 wrap-anywhere'>{pair.from}</span>
                      <ArrowRight
                        className='mt-0.5 size-3.5 shrink-0'
                        aria-hidden='true'
                      />
                      <span className='min-w-0 wrap-anywhere'>{pair.to}</span>
                    </li>
                  ))}
                  {remaining > 0 && (
                    <li className='text-muted-foreground'>
                      {t('+{{count}} more', { count: remaining })}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {derivation.unchanged.length > 0 && (
              <p className='text-muted-foreground text-xs'>
                {t('{{count}} model(s) unchanged by the rule were skipped', {
                  count: derivation.unchanged.length,
                })}
              </p>
            )}
            {derivation.conflicts.length > 0 && (
              <p className='text-warning text-xs'>
                {t(
                  '{{count}} model(s) skipped because another model derives the same request name',
                  { count: derivation.conflicts.length }
                )}
              </p>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  )
}
