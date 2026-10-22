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
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from 'lucide-react'
import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type {
  ChannelModelMappingRule,
  ChannelModelMappingRuleType,
} from '../types'

type ModelMappingRulesEditorProps = {
  value: ChannelModelMappingRule[]
  onChange: (rules: ChannelModelMappingRule[]) => void
  onApplyToExisting: () => void
  disabled?: boolean
  applying?: boolean
}

function emptyRule(type: ChannelModelMappingRuleType): ChannelModelMappingRule {
  if (type === 'strip_prefix' || type === 'strip_suffix') {
    return { type, values: '' }
  }
  if (type === 'add_prefix' || type === 'add_suffix') return { type, value: '' }
  return { type, find: '', replace_with: '' }
}

export function ModelMappingRulesEditor(props: ModelMappingRulesEditorProps) {
  const { t } = useTranslation()
  const id = useId()
  const ruleOptions: Array<{
    value: ChannelModelMappingRuleType
    label: string
  }> = [
    { value: 'strip_prefix', label: t('Strip prefix') },
    { value: 'strip_suffix', label: t('Strip suffix') },
    { value: 'add_prefix', label: t('Add prefix') },
    { value: 'add_suffix', label: t('Add suffix') },
    { value: 'replace', label: t('Replace text') },
    { value: 'regex_replace', label: t('Replace by regular expression') },
  ]

  // Rules have no identity of their own; row keys follow each rule through
  // moves and removals so an input keeps focus while its rule is edited.
  const nextKeyRef = useRef(0)
  const keysRef = useRef<number[]>([])
  if (keysRef.current.length !== props.value.length) {
    keysRef.current = props.value.map(() => nextKeyRef.current++)
  }

  const updateRule = (index: number, rule: ChannelModelMappingRule) => {
    props.onChange(props.value.map((item, i) => (i === index ? rule : item)))
  }
  const moveRule = (index: number, offset: number) => {
    const next = [...props.value]
    const keys = [...keysRef.current]
    const [rule] = next.splice(index, 1)
    const [key] = keys.splice(index, 1)
    next.splice(index + offset, 0, rule)
    keys.splice(index + offset, 0, key)
    keysRef.current = keys
    props.onChange(next)
  }
  const removeRule = (index: number) => {
    keysRef.current = keysRef.current.filter((_, i) => i !== index)
    props.onChange(props.value.filter((_, i) => i !== index))
  }
  const addRule = () => {
    keysRef.current = [...keysRef.current, nextKeyRef.current++]
    props.onChange([...props.value, emptyRule('strip_prefix')])
  }

  return (
    <div className='flex flex-col gap-3'>
      {props.value.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('No rules. Synced models keep their upstream names.')}
        </p>
      )}
      <ol className='flex flex-col gap-3'>
        {props.value.map((rule, index) => {
          const fieldId = `${id}-${index}`
          const isStrip =
            rule.type === 'strip_prefix' || rule.type === 'strip_suffix'
          const isAdd = rule.type === 'add_prefix' || rule.type === 'add_suffix'
          const isPrefix =
            rule.type === 'strip_prefix' || rule.type === 'add_prefix'
          return (
            <li
              key={keysRef.current[index]}
              aria-label={t('Rule {{index}}', { index: index + 1 })}
              className='grid gap-3 rounded-lg border p-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start'
            >
              <Field>
                <FieldLabel htmlFor={`${fieldId}-type`}>{t('Rule')}</FieldLabel>
                <Select
                  items={ruleOptions}
                  value={rule.type}
                  disabled={props.disabled}
                  onValueChange={(value) => {
                    const option = ruleOptions.find(
                      (item) => item.value === value
                    )
                    if (option) updateRule(index, emptyRule(option.value))
                  }}
                >
                  <SelectTrigger id={`${fieldId}-type`} className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {isStrip || isAdd ? (
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-affix`}>
                    {isPrefix ? t('Prefix') : t('Suffix')}
                  </FieldLabel>
                  <Input
                    id={`${fieldId}-affix`}
                    placeholder={isPrefix ? 'relay/' : '-latest'}
                    disabled={props.disabled}
                    value={(isStrip ? rule.values : rule.value) ?? ''}
                    onChange={(event) =>
                      updateRule(
                        index,
                        isStrip
                          ? { type: rule.type, values: event.target.value }
                          : { type: rule.type, value: event.target.value }
                      )
                    }
                  />
                  {isStrip && (
                    <FieldDescription>
                      {t('Separate several values with commas')}
                    </FieldDescription>
                  )}
                </Field>
              ) : (
                <div className='grid gap-3 sm:grid-cols-2'>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-find`}>
                      {rule.type === 'regex_replace'
                        ? t('Regular expression')
                        : t('Find')}
                    </FieldLabel>
                    <Input
                      id={`${fieldId}-find`}
                      className='font-mono'
                      placeholder={
                        rule.type === 'regex_replace' ? '(?i)^minimax-m' : '_'
                      }
                      disabled={props.disabled}
                      value={rule.find ?? ''}
                      onChange={(event) =>
                        updateRule(index, { ...rule, find: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-replace`}>
                      {t('Replace with')}
                    </FieldLabel>
                    <Input
                      id={`${fieldId}-replace`}
                      className='font-mono'
                      placeholder={
                        rule.type === 'regex_replace' ? 'MiniMax-M' : '-'
                      }
                      disabled={props.disabled}
                      value={rule.replace_with ?? ''}
                      onChange={(event) =>
                        updateRule(index, {
                          ...rule,
                          replace_with: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              <div className='flex gap-1 sm:pt-6'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Move rule up')}
                  disabled={props.disabled || index === 0}
                  onClick={() => moveRule(index, -1)}
                >
                  <ArrowUp className='size-4' aria-hidden='true' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Move rule down')}
                  disabled={props.disabled || index === props.value.length - 1}
                  onClick={() => moveRule(index, 1)}
                >
                  <ArrowDown className='size-4' aria-hidden='true' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Remove rule')}
                  disabled={props.disabled}
                  onClick={() => removeRule(index)}
                >
                  <Trash2 className='size-4' aria-hidden='true' />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={props.disabled}
          onClick={addRule}
        >
          <Plus className='size-4' aria-hidden='true' />
          {t('Add rule')}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={
            props.disabled || props.applying || props.value.length === 0
          }
          onClick={props.onApplyToExisting}
        >
          <ListChecks className='size-4' aria-hidden='true' />
          {t('Apply to existing models')}
        </Button>
      </div>
    </div>
  )
}
