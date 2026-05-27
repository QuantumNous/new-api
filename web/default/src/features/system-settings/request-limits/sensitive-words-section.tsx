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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { MultiSelect, type Option } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getSensitiveScopeOptions } from '../api'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import type { SensitiveScopeModelOption } from '../types'

const sensitiveSchema = z.object({
  CheckSensitiveEnabled: z.boolean(),
  CheckSensitiveOnPromptEnabled: z.boolean(),
  SensitiveWords: z.string().optional(),
  SensitiveCheckRules: z.string().optional(),
})

type SensitiveFormValues = z.infer<typeof sensitiveSchema>

type SensitiveWordsSectionProps = {
  defaultValues: SensitiveFormValues
}

type SensitiveCheckRule = {
  id: string
  name: string
  enabled: boolean
  groups: string[]
  models: string[]
  model_regex: string[]
  include_global_words: boolean
  words: string[]
}

type SensitiveCheckRuleConfig = {
  version: number
  rules: SensitiveCheckRule[]
}

const emptyRuleConfig: SensitiveCheckRuleConfig = {
  version: 1,
  rules: [],
}

function createRuleId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function createRule(name = 'New rule'): SensitiveCheckRule {
  return {
    id: createRuleId(),
    name,
    enabled: true,
    groups: [],
    models: [],
    model_regex: [],
    include_global_words: true,
    words: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

function normalizeRule(value: unknown, index: number): SensitiveCheckRule {
  if (!isRecord(value)) {
    return createRule(`Rule ${index + 1}`)
  }
  return {
    id:
      typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : createRuleId(),
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : `Rule ${index + 1}`,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    groups: normalizeStringArray(value.groups),
    models: normalizeStringArray(value.models),
    model_regex: normalizeStringArray(value.model_regex),
    include_global_words:
      typeof value.include_global_words === 'boolean'
        ? value.include_global_words
        : true,
    words: normalizeStringArray(value.words),
  }
}

function parseRuleConfig(value: string | undefined): SensitiveCheckRuleConfig {
  if (!value || value.trim() === '') {
    return emptyRuleConfig
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed)) {
      return emptyRuleConfig
    }
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      rules: Array.isArray(parsed.rules)
        ? parsed.rules.map((rule, index) => normalizeRule(rule, index))
        : [],
    }
  } catch {
    return emptyRuleConfig
  }
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function stringifyRuleConfig(rules: SensitiveCheckRule[]) {
  const normalizedRules = rules.map((rule) => ({
    id: rule.id,
    name: rule.name.trim(),
    enabled: rule.enabled,
    groups: normalizeStringArray(rule.groups),
    models: normalizeStringArray(rule.models),
    model_regex: normalizeStringArray(rule.model_regex),
    include_global_words: rule.include_global_words,
    words: normalizeStringArray(rule.words),
  }))
  return JSON.stringify({ version: 1, rules: normalizedRules }, null, 2)
}

function intersects(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return false
  const rightSet = new Set(right)
  return left.some((item) => rightSet.has(item))
}

export function SensitiveWordsSection({
  defaultValues,
}: SensitiveWordsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [filterModelsByGroup, setFilterModelsByGroup] = useState<
    Record<string, boolean>
  >({})
  const form = useForm<SensitiveFormValues>({
    resolver: zodResolver(sensitiveSchema),
    defaultValues,
  })

  const scopeOptionsQuery = useQuery({
    queryKey: ['sensitive-scope-options'],
    queryFn: getSensitiveScopeOptions,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const ruleConfigValue = form.watch('SensitiveCheckRules')
  const ruleConfig = useMemo(
    () => parseRuleConfig(ruleConfigValue),
    [ruleConfigValue]
  )
  const rules = ruleConfig.rules

  const groupOptions = useMemo<Option[]>(() => {
    const groups = scopeOptionsQuery.data?.data.groups ?? []
    return groups.map((group) => ({
      value: group.value,
      label: group.desc ? `${group.label} (${group.desc})` : group.label,
    }))
  }, [scopeOptionsQuery.data?.data.groups])

  const modelOptions = useMemo<Option[]>(() => {
    const models = scopeOptionsQuery.data?.data.models ?? []
    return models.map((model) => ({
      value: model.value,
      label: model.vendor ? `${model.label} - ${model.vendor}` : model.label,
    }))
  }, [scopeOptionsQuery.data?.data.models])

  const modelOptionByValue = useMemo(() => {
    const map = new Map<string, SensitiveScopeModelOption>()
    for (const model of scopeOptionsQuery.data?.data.models ?? []) {
      map.set(model.value, model)
    }
    return map
  }, [scopeOptionsQuery.data?.data.models])

  const onSubmit = async (values: SensitiveFormValues) => {
    const updates = Object.entries(values).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof SensitiveFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
    }
  }

  const updateRules = (nextRules: SensitiveCheckRule[]) => {
    form.setValue('SensitiveCheckRules', stringifyRuleConfig(nextRules), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const updateRule = (ruleId: string, patch: Partial<SensitiveCheckRule>) => {
    updateRules(
      rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )
    )
  }

  const addRule = () => {
    const rule = createRule(t('New rule'))
    setFilterModelsByGroup((current) => ({ ...current, [rule.id]: true }))
    updateRules([...rules, rule])
  }

  const copyRule = (rule: SensitiveCheckRule) => {
    const nextRule = {
      ...rule,
      id: createRuleId(),
      name: rule.name ? `${rule.name} ${t('copy')}` : t('New rule'),
    }
    setFilterModelsByGroup((current) => ({
      ...current,
      [nextRule.id]: current[rule.id] ?? true,
    }))
    updateRules([...rules, nextRule])
  }

  const deleteRule = (ruleId: string) => {
    updateRules(rules.filter((rule) => rule.id !== ruleId))
    setFilterModelsByGroup((current) => {
      const next = { ...current }
      delete next[ruleId]
      return next
    })
  }

  const getModelOptionsForRule = (rule: SensitiveCheckRule) => {
    const shouldFilter = filterModelsByGroup[rule.id] ?? true
    if (!shouldFilter || rule.groups.length === 0) {
      return modelOptions
    }

    const filteredOptions = modelOptions.filter((option) => {
      const model = modelOptionByValue.get(option.value)
      if (!model || model.enable_groups.length === 0) return true
      return intersects(model.enable_groups, rule.groups)
    })
    const optionValues = new Set(filteredOptions.map((option) => option.value))
    const selectedMissingOptions = rule.models
      .filter((model) => !optionValues.has(model))
      .map((model) => ({ value: model, label: model }))
    return [...selectedMissingOptions, ...filteredOptions]
  }

  return (
    <SettingsSection title={t('Sensitive Words')}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-6'
        >
          <div className='flex flex-col gap-4'>
            <FormField
              control={form.control}
              name='CheckSensitiveEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='flex flex-col gap-1'>
                    <FormLabel className='text-base'>
                      {t('Enable filtering')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Blocks messages when sensitive keywords are detected.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='CheckSensitiveOnPromptEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='flex flex-col gap-1'>
                    <FormLabel className='text-base'>
                      {t('Inspect user prompts')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'When enabled, prompts are scanned before reaching upstream models.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='SensitiveWords'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Blocked keywords')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={10}
                    placeholder={t('Enter one keyword per line')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Each line represents one keyword. Leave blank to disable the list but keep the switch states.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='flex flex-col gap-1'>
                <h3 className='text-base font-medium'>
                  {t('Scoped filtering rules')}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'When rules exist, only matching group and model scopes are checked.'
                  )}
                </p>
              </div>
              <Button type='button' variant='outline' onClick={addRule}>
                <Plus data-icon='inline-start' />
                {t('Add rule')}
              </Button>
            </div>

            {rules.length === 0 ? (
              <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
                {t(
                  'No scoped rules configured. The global keyword list applies to every request.'
                )}
              </div>
            ) : (
              <div className='flex flex-col gap-4'>
                {rules.map((rule, index) => {
                  const ruleModelOptions = getModelOptionsForRule(rule)
                  return (
                    <div
                      key={rule.id}
                      className='flex flex-col gap-4 rounded-lg border p-4'
                    >
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex min-w-64 flex-1 items-center gap-3'>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) =>
                              updateRule(rule.id, { enabled: checked })
                            }
                            aria-label={t('Rule enabled')}
                          />
                          <Input
                            value={rule.name}
                            onChange={(event) =>
                              updateRule(rule.id, {
                                name: event.target.value,
                              })
                            }
                            placeholder={t('Rule name')}
                          />
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => copyRule(rule)}
                          >
                            <Copy data-icon='inline-start' />
                            {t('Copy')}
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 data-icon='inline-start' />
                            {t('Delete')}
                          </Button>
                        </div>
                      </div>

                      <div className='grid gap-4 md:grid-cols-2'>
                        <div className='flex flex-col gap-2'>
                          <label className='text-sm font-medium'>
                            {t('Groups')}
                          </label>
                          <MultiSelect
                            options={groupOptions}
                            selected={rule.groups}
                            onChange={(groups) =>
                              updateRule(rule.id, { groups })
                            }
                            placeholder={t('All groups')}
                          />
                          <p className='text-muted-foreground text-sm'>
                            {t('Leave empty to apply to every group.')}
                          </p>
                        </div>

                        <div className='flex flex-col gap-2'>
                          <label className='text-sm font-medium'>
                            {t('Models')}
                          </label>
                          <MultiSelect
                            options={ruleModelOptions}
                            selected={rule.models}
                            onChange={(models) =>
                              updateRule(rule.id, { models })
                            }
                            placeholder={
                              scopeOptionsQuery.isLoading
                                ? t('Loading models...')
                                : t('All models')
                            }
                            maxVisibleOptions={300}
                          />
                          <div className='flex items-center justify-between gap-3'>
                            <p className='text-muted-foreground text-sm'>
                              {t('Leave empty to apply to every model.')}
                            </p>
                            <div className='flex items-center gap-2'>
                              <span className='text-muted-foreground text-sm'>
                                {t('Filter by groups')}
                              </span>
                              <Switch
                                checked={filterModelsByGroup[rule.id] ?? true}
                                onCheckedChange={(checked) =>
                                  setFilterModelsByGroup((current) => ({
                                    ...current,
                                    [rule.id]: checked,
                                  }))
                                }
                                aria-label={t(
                                  'Filter models by selected groups'
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='grid gap-4 md:grid-cols-2'>
                        <div className='flex flex-col gap-2'>
                          <label className='text-sm font-medium'>
                            {t('Model regex')}
                          </label>
                          <Textarea
                            rows={4}
                            value={rule.model_regex.join('\n')}
                            onChange={(event) =>
                              updateRule(rule.id, {
                                model_regex: splitLines(event.target.value),
                              })
                            }
                            placeholder={t('One regex per line')}
                          />
                        </div>

                        <div className='flex flex-col gap-2'>
                          <label className='text-sm font-medium'>
                            {t('Rule keywords')}
                          </label>
                          <Textarea
                            rows={4}
                            value={rule.words.join('\n')}
                            onChange={(event) =>
                              updateRule(rule.id, {
                                words: splitLines(event.target.value),
                              })
                            }
                            placeholder={t('One keyword per line')}
                          />
                        </div>
                      </div>

                      <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border p-3'>
                        <div className='flex flex-col gap-1'>
                          <span className='text-sm font-medium'>
                            {t('Include global keywords')}
                          </span>
                          <span className='text-muted-foreground text-sm'>
                            {t(
                              'Use the global keyword list together with this rule.'
                            )}
                          </span>
                        </div>
                        <Switch
                          checked={rule.include_global_words}
                          onCheckedChange={(checked) =>
                            updateRule(rule.id, {
                              include_global_words: checked,
                            })
                          }
                        />
                      </div>

                      <p className='text-muted-foreground text-xs'>
                        {t('Rule {{index}}', { index: index + 1 })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save sensitive words')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
