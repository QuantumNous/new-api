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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RULE_TEMPLATES } from './constants'
import type { AffinityRule, KeySource } from './types'

const KEY_SOURCE_TYPES = ['context_int', 'context_string', 'gjson'] as const

const CONTEXT_KEY_PRESETS = [
  'id',
  'token_id',
  'token_key',
  'token_group',
  'group',
  'username',
  'user_group',
  'user_email',
  'specific_channel_id',
]

interface RuleFormValues {
  name: string
  model_regex_text: string
  path_regex_text: string
  user_agent_include_text: string
  value_regex: string
  ttl_seconds: number
  skip_retry_on_failure: boolean
  include_using_group: boolean
  include_model_name: boolean
  include_rule_name: boolean
  param_override_template_json: string
}

function normalizeStringList(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function normalizeKeySource(src: Partial<KeySource>): KeySource {
  const type = (src?.type || 'gjson') as KeySource['type']
  if (type === 'gjson') return { type, key: '', path: src?.path || '' }
  return { type, key: src?.key || '', path: '' }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: AffinityRule | null
  onSave: (rule: AffinityRule) => void
  templateKey?: string | null
}

export function RuleEditorDialog(props: Props) {
  const { t } = useTranslation()
  const isEdit = !!props.rule?.name
  const [keySources, setKeySources] = useState<KeySource[]>([
    { type: 'gjson', path: '' },
  ])
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const form = useForm<RuleFormValues>({
    defaultValues: {
      name: '',
      model_regex_text: '',
      path_regex_text: '',
      user_agent_include_text: '',
      value_regex: '',
      ttl_seconds: 0,
      skip_retry_on_failure: false,
      include_using_group: true,
      include_model_name: false,
      include_rule_name: true,
      param_override_template_json: '',
    },
  })

  const resetFromRule = (r: Partial<AffinityRule>) => {
    form.reset({
      name: r.name || '',
      model_regex_text: (r.model_regex || []).join('\n'),
      path_regex_text: (r.path_regex || []).join('\n'),
      user_agent_include_text: (r.user_agent_include || []).join('\n'),
      value_regex: r.value_regex || '',
      ttl_seconds: r.ttl_seconds || 0,
      skip_retry_on_failure: !!r.skip_retry_on_failure,
      include_using_group: r.include_using_group ?? true,
      include_model_name: !!r.include_model_name,
      include_rule_name: r.include_rule_name ?? true,
      param_override_template_json: r.param_override_template
        ? JSON.stringify(r.param_override_template, null, 2)
        : '',
    })
    const sources = (r.key_sources || []).map(normalizeKeySource)
    setKeySources(sources.length > 0 ? sources : [{ type: 'gjson', path: '' }])
    if (r.param_override_template) setAdvancedOpen(true)
  }

  useEffect(() => {
    if (!props.open) return

    if (props.rule) {
      resetFromRule(props.rule)
    } else if (props.templateKey && RULE_TEMPLATES[props.templateKey]) {
      resetFromRule(RULE_TEMPLATES[props.templateKey])
    } else {
      form.reset({
        name: '',
        model_regex_text: '',
        path_regex_text: '',
        user_agent_include_text: '',
        value_regex: '',
        ttl_seconds: 0,
        skip_retry_on_failure: false,
        include_using_group: true,
        include_model_name: false,
        include_rule_name: true,
        param_override_template_json: '',
      })
      setKeySources([{ type: 'gjson', path: '' }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.rule, props.templateKey])

  const handleSave = (values: RuleFormValues) => {
    const modelRegex = normalizeStringList(values.model_regex_text)
    if (modelRegex.length === 0) {
      toast.error(t('At least one model regex pattern is required'))
      return
    }

    const validKeySources = keySources
      .map(normalizeKeySource)
      .filter((s) => s.type && (s.type === 'gjson' ? s.path : s.key))
    if (validKeySources.length === 0) {
      toast.error(t('At least one valid key source is required'))
      return
    }

    let paramTemplate: Record<string, unknown> | null = null
    if (values.param_override_template_json.trim()) {
      try {
        const parsed = JSON.parse(values.param_override_template_json)
        if (
          typeof parsed !== 'object' ||
          Array.isArray(parsed) ||
          parsed === null
        ) {
          toast.error(t('Parameter override template must be a JSON object'))
          return
        }
        paramTemplate = parsed
      } catch {
        toast.error(t('Invalid JSON in parameter override template'))
        return
      }
    }

    const rule: AffinityRule = {
      id: props.rule?.id,
      name: values.name.trim(),
      model_regex: modelRegex,
      path_regex: normalizeStringList(values.path_regex_text),
      user_agent_include: normalizeStringList(values.user_agent_include_text),
      key_sources: validKeySources,
      value_regex: values.value_regex.trim(),
      ttl_seconds: Number(values.ttl_seconds || 0),
      skip_retry_on_failure: values.skip_retry_on_failure,
      include_using_group: values.include_using_group,
      include_model_name: values.include_model_name,
      include_rule_name: values.include_rule_name,
      param_override_template: paramTemplate,
    }

    props.onSave(rule)
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('Edit Rule') : t('Add Rule')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSave)} className='space-y-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Name')} *</Label>
            <Input
              placeholder='prefer-by-conversation-id'
              {...form.register('name', { required: true })}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Model Regex (one per line)')} *</Label>
              <Textarea
                rows={4}
                placeholder={'^gpt-4o.*$\n^claude-3.*$'}
                {...form.register('model_regex_text', { required: true })}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Path Regex (one per line)')}</Label>
              <Textarea
                rows={4}
                placeholder='/v1/chat/completions'
                {...form.register('path_regex_text')}
              />
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Switch
              checked={form.watch('skip_retry_on_failure')}
              onCheckedChange={(v) => form.setValue('skip_retry_on_failure', v)}
            />
            <Label>{t('Skip retry on failure')}</Label>
          </div>

          <Separator />

          {/* Key Sources */}
          <div>
            <div className='mb-2 flex items-center justify-between'>
              <Label>{t('Key Sources')}</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  setKeySources((prev) => [
                    ...prev,
                    { type: 'gjson', path: '' },
                  ])
                }
              >
                <Plus className='mr-1 h-3 w-3' />
                {t('Add')}
              </Button>
            </div>
            <p className='text-muted-foreground mb-2 text-xs'>
              {t('Common Keys')}: {CONTEXT_KEY_PRESETS.join(', ')}
            </p>
            <div className='space-y-2'>
              {keySources.map((src, idx) => (
                <div key={idx} className='flex items-center gap-2'>
                  <Select
                    items={[
                      ...KEY_SOURCE_TYPES.map((t) => ({ value: t, label: t })),
                    ]}
                    value={src.type}
                    onValueChange={(v) => {
                      if (v === null) return
                      const next = [...keySources]
                      next[idx] = normalizeKeySource({
                        ...src,
                        type: v as KeySource['type'],
                      })
                      setKeySources(next)
                    }}
                  >
                    <SelectTrigger className='w-[160px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {KEY_SOURCE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    className='flex-1'
                    placeholder={
                      src.type === 'gjson'
                        ? 'metadata.conversation_id'
                        : 'user_id'
                    }
                    value={
                      src.type === 'gjson' ? src.path || '' : src.key || ''
                    }
                    onChange={(e) => {
                      const next = [...keySources]
                      if (src.type === 'gjson') {
                        next[idx] = { ...src, path: e.target.value }
                      } else {
                        next[idx] = { ...src, key: e.target.value }
                      }
                      setKeySources(next)
                    }}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() =>
                      setKeySources((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Advanced */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  className='w-full justify-start'
                />
              }
            >
              {advancedOpen ? '▼' : '▶'} {t('Advanced Settings')}
            </CollapsibleTrigger>
            <CollapsibleContent className='space-y-3 pt-2'>
              <div className='grid gap-1.5'>
                <Label>{t('User-Agent include (one per line)')}</Label>
                <Textarea
                  rows={3}
                  placeholder='curl&#10;PostmanRuntime'
                  {...form.register('user_agent_include_text')}
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='grid gap-1.5'>
                  <Label>{t('Value Regex')}</Label>
                  <Input
                    placeholder='^[-0-9A-Za-z._:]{1,128}$'
                    {...form.register('value_regex')}
                  />
                </div>
                <div className='grid gap-1.5'>
                  <Label>{t('TTL (seconds, 0 = default)')}</Label>
                  <Input
                    type='number'
                    min={0}
                    {...form.register('ttl_seconds')}
                  />
                </div>
              </div>

              <div className='grid gap-1.5'>
                <Label>{t('Parameter Override Template (JSON)')}</Label>
                <Textarea
                  rows={5}
                  placeholder='{"operations": [...]}'
                  {...form.register('param_override_template_json')}
                  className='font-mono text-xs'
                />
              </div>

              <div className='grid grid-cols-3 gap-3'>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={form.watch('include_using_group')}
                    onCheckedChange={(v) =>
                      form.setValue('include_using_group', v)
                    }
                  />
                  <Label className='text-xs'>{t('Include Group')}</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={form.watch('include_model_name')}
                    onCheckedChange={(v) =>
                      form.setValue('include_model_name', v)
                    }
                  />
                  <Label className='text-xs'>{t('Include Model')}</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={form.watch('include_rule_name')}
                    onCheckedChange={(v) =>
                      form.setValue('include_rule_name', v)
                    }
                  />
                  <Label className='text-xs'>{t('Include Rule Name')}</Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit'>{t('Save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
