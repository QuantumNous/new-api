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
import { Edit, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { StatusBadge, StatusBadgeList } from '@/components/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'

import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsPageActionsPortal } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type RefusalFallbackRule = {
  id: number
  name: string
  model_regex: string[]
  path_regex?: string[]
  groups?: string[]
  fallback_group: string
  cooldown_seconds: number
}

type RefusalFallbackSettings = {
  GroupRatio: string
  'refusal_fallback_setting.enabled': boolean
  'refusal_fallback_setting.rules': string
}

function parseRules(raw: string): RefusalFallbackRule[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((rule, index) => ({
      id: index,
      ...(rule as Omit<RefusalFallbackRule, 'id'>),
    }))
  } catch {
    return []
  }
}

function serializeRules(rules: RefusalFallbackRule[]): string {
  return JSON.stringify(rules.map(({ id: _, ...rule }) => rule))
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function validateRegexList(patterns: string[]): boolean {
  try {
    patterns.forEach((pattern) => new RegExp(pattern))
    return true
  } catch {
    return false
  }
}

function parseGroupNames(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }
    return Object.keys(parsed)
      .filter((group) => group !== 'auto')
      .sort()
  } catch {
    return []
  }
}

function RefusalFallbackRuleDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: RefusalFallbackRule | null
  groupOptions: string[]
  existingNames: string[]
  onSave: (rule: RefusalFallbackRule) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [modelRegex, setModelRegex] = useState('')
  const [pathRegex, setPathRegex] = useState('^/v1/messages$')
  const [groups, setGroups] = useState('')
  const [fallbackGroup, setFallbackGroup] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(3600)

  useEffect(() => {
    if (!props.open) return
    setName(props.rule?.name ?? '')
    setModelRegex((props.rule?.model_regex ?? []).join('\n'))
    setPathRegex((props.rule?.path_regex ?? ['^/v1/messages$']).join('\n'))
    setGroups((props.rule?.groups ?? []).join('\n'))
    setFallbackGroup(props.rule?.fallback_group ?? '')
    setCooldownSeconds(props.rule?.cooldown_seconds ?? 3600)
  }, [props.open, props.rule])

  const selectableGroups = useMemo(() => {
    const result = [...props.groupOptions]
    if (fallbackGroup && !result.includes(fallbackGroup)) {
      result.push(fallbackGroup)
    }
    return result.sort()
  }, [fallbackGroup, props.groupOptions])

  const groupItems = useMemo(
    () => selectableGroups.map((group) => ({ value: group, label: group })),
    [selectableGroups]
  )

  const handleSave = () => {
    const trimmedName = name.trim()
    const models = splitList(modelRegex)
    const paths = splitList(pathRegex)
    const scopedGroups = splitList(groups)
    if (!trimmedName) {
      toast.error(t('Rule name is required'))
      return
    }
    if (
      props.existingNames.some(
        (existing) => existing === trimmedName && existing !== props.rule?.name
      )
    ) {
      toast.error(t('Rule name must be unique'))
      return
    }
    if (models.length === 0) {
      toast.error(t('At least one model regex is required'))
      return
    }
    if (!validateRegexList([...models, ...paths])) {
      toast.error(t('Model or path regex is invalid'))
      return
    }
    if (!fallbackGroup) {
      toast.error(t('Select a fallback group'))
      return
    }
    if (cooldownSeconds <= 0 || cooldownSeconds > 2592000) {
      toast.error(t('Cooldown must be between 1 second and 30 days'))
      return
    }

    props.onSave({
      id: props.rule?.id ?? -1,
      name: trimmedName,
      model_regex: models,
      ...(paths.length > 0 ? { path_regex: paths } : {}),
      ...(scopedGroups.length > 0 ? { groups: scopedGroups } : {}),
      fallback_group: fallbackGroup,
      cooldown_seconds: cooldownSeconds,
    })
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        props.rule
          ? t('Edit Refusal Fallback Rule')
          : t('Add Refusal Fallback Rule')
      }
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave}>{t('Save')}</Button>
        </>
      }
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5 sm:col-span-2'>
          <Label htmlFor='refusal-fallback-name'>{t('Name')}</Label>
          <Input
            id='refusal-fallback-name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Claude refusal fallback')}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='refusal-fallback-models'>{t('Model Regex')}</Label>
          <Textarea
            id='refusal-fallback-models'
            value={modelRegex}
            onChange={(event) => setModelRegex(event.target.value)}
            placeholder='^claude-sonnet-.*$'
            className='min-h-24 font-mono text-xs'
          />
          <span className='text-muted-foreground text-xs'>
            {t('One regex per line. Rules are evaluated from top to bottom.')}
          </span>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='refusal-fallback-paths'>{t('Path Regex')}</Label>
          <Textarea
            id='refusal-fallback-paths'
            value={pathRegex}
            onChange={(event) => setPathRegex(event.target.value)}
            className='min-h-24 font-mono text-xs'
          />
          <span className='text-muted-foreground text-xs'>
            {t('Optional. Leave empty to match every request path.')}
          </span>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Fallback Group')}</Label>
          <Select
            items={groupItems}
            value={fallbackGroup || null}
            onValueChange={(value) => setFallbackGroup(value ?? '')}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Select a fallback group')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {selectableGroups.map((group) => (
                  <SelectItem
                    key={group}
                    value={group}
                    disabled={!props.groupOptions.includes(group)}
                  >
                    {group}
                    {!props.groupOptions.includes(group)
                      ? ` · ${t('Unavailable group')}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='refusal-fallback-cooldown'>
            {t('Cooldown (seconds)')}
          </Label>
          <Input
            id='refusal-fallback-cooldown'
            type='number'
            min={1}
            max={2592000}
            value={cooldownSeconds}
            onChange={(event) => setCooldownSeconds(Number(event.target.value))}
          />
        </div>
        <div className='grid gap-1.5 sm:col-span-2'>
          <Label htmlFor='refusal-fallback-groups'>{t('Groups')}</Label>
          <Input
            id='refusal-fallback-groups'
            value={groups}
            onChange={(event) => setGroups(event.target.value)}
            placeholder={t('Optional, comma-separated')}
          />
        </div>
      </div>
    </Dialog>
  )
}

export function RefusalFallbackSection(props: {
  defaultValues: RefusalFallbackSettings
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [enabled, setEnabled] = useState(
    props.defaultValues['refusal_fallback_setting.enabled']
  )
  const [rules, setRules] = useState<RefusalFallbackRule[]>(() =>
    parseRules(props.defaultValues['refusal_fallback_setting.rules'])
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RefusalFallbackRule | null>(
    null
  )
  const [saving, setSaving] = useState(false)

  const groupOptions = useMemo(
    () => parseGroupNames(props.defaultValues.GroupRatio),
    [props.defaultValues.GroupRatio]
  )

  useEffect(() => {
    setEnabled(props.defaultValues['refusal_fallback_setting.enabled'])
    setRules(parseRules(props.defaultValues['refusal_fallback_setting.rules']))
  }, [props.defaultValues])

  const handleRuleSave = (rule: RefusalFallbackRule) => {
    setRules((current) => {
      if (rule.id >= 0) {
        return current.map((item) => (item.id === rule.id ? rule : item))
      }
      return [...current, { ...rule, id: current.length }]
    })
  }

  const handleDelete = (id: number) => {
    setRules((current) =>
      current
        .filter((rule) => rule.id !== id)
        .map((rule, index) => ({ ...rule, id: index }))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (enabled !== props.defaultValues['refusal_fallback_setting.enabled']) {
        const result = await updateOption.mutateAsync({
          key: 'refusal_fallback_setting.enabled',
          value: enabled,
        })
        if (!result.success) return
      }

      const serialized = serializeRules(rules)
      const original = serializeRules(
        parseRules(props.defaultValues['refusal_fallback_setting.rules'])
      )
      if (serialized !== original) {
        await updateOption.mutateAsync({
          key: 'refusal_fallback_setting.rules',
          value: serialized,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SettingsSection title={t('Refusal Fallback')}>
        <Alert>
          <AlertDescription className='text-xs'>
            {t(
              'After an upstream refusal, route the same token, model, and group through the configured fallback group for a fixed cooldown. When the cooldown expires, the primary route is probed again.'
            )}
          </AlertDescription>
        </Alert>

        <SettingsSwitchField
          checked={enabled}
          onCheckedChange={setEnabled}
          label={t('Enable refusal fallback')}
          description={t(
            'Fallback requests do not refresh the cooldown. The fallback group affects routing only; billing stays on the original user group.'
          )}
        />

        <SettingsPageActionsPortal>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              setEditingRule(null)
              setDialogOpen(true)
            }}
          >
            <Plus className='mr-1 h-3 w-3' />
            {t('Add Rule')}
          </Button>
          <Button size='sm' onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </SettingsPageActionsPortal>

        <StaticDataTable
          data={rules}
          getRowKey={(rule) => rule.id}
          emptyContent={t('No refusal fallback rules yet')}
          emptyClassName='text-muted-foreground py-8'
          columns={[
            {
              id: 'name',
              header: t('Name'),
              cellClassName: 'font-medium',
              cell: (rule) => rule.name,
            },
            {
              id: 'models',
              header: t('Model Regex'),
              cell: (rule) => (
                <StatusBadgeList
                  items={rule.model_regex}
                  max={2}
                  getKey={(item) => item}
                  renderItem={(item) => (
                    <StatusBadge
                      label={item}
                      variant='neutral'
                      size='sm'
                      copyable={false}
                    />
                  )}
                />
              ),
            },
            {
              id: 'groups',
              header: t('Groups'),
              cell: (rule) => rule.groups?.join(', ') || t('All groups'),
            },
            {
              id: 'fallback-group',
              header: t('Fallback Group'),
              cell: (rule) => rule.fallback_group,
            },
            {
              id: 'cooldown',
              header: t('Cooldown (seconds)'),
              cell: (rule) => rule.cooldown_seconds,
            },
            {
              id: 'actions',
              header: t('Actions'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (rule) => (
                <div className='flex justify-end gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7'
                    aria-label={t('Edit')}
                    onClick={() => {
                      setEditingRule(rule)
                      setDialogOpen(true)
                    }}
                  >
                    <Edit className='h-3 w-3' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7'
                    aria-label={t('Delete')}
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </SettingsSection>

      <RefusalFallbackRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        groupOptions={groupOptions}
        existingNames={rules.map((rule) => rule.name)}
        onSave={handleRuleSave}
      />
    </>
  )
}
