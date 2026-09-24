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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { SettingsCard } from '../../components/settings-card'
import { saveSensitiveWordPolicy } from './api'
import type { SensitiveWordPolicy } from './types'

type PolicyFormProps = {
  policy: SensitiveWordPolicy
  onSaved: (policy: SensitiveWordPolicy) => void
}

export function SensitiveWordPolicyForm({ policy, onSaved }: PolicyFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(policy)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(policy), [policy])

  const update = <K extends keyof SensitiveWordPolicy>(
    key: K,
    value: SensitiveWordPolicy[K]
  ) => setDraft((current) => ({ ...current, [key]: value }))

  async function save() {
    if (draft.ban_threshold < 1 || draft.ban_threshold > 1000) {
      toast.error(t('Ban threshold must be between 1 and 1000'))
      return
    }
    if (
      draft.full_prompt_retention_days < 1 ||
      draft.full_prompt_retention_days > 3650
    ) {
      toast.error(t('Retention must be between 1 and 3650 days'))
      return
    }
    if (draft.max_prompt_runes < 1 || draft.max_prompt_runes > 65536) {
      toast.error(t('Prompt limit must be between 1 and 65536 characters'))
      return
    }
    setSaving(true)
    try {
      onSaved(await saveSensitiveWordPolicy(draft))
      toast.success(t('Saved successfully'))
    } catch {
      toast.error(t('Unable to save sensitive-word policy'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      title={t('Sensitive-word policy')}
      description={t(
        'Control prompt matching, evidence retention, and account enforcement.'
      )}
      className='shadow-none'
    >
      <div className='space-y-5'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <label className='flex items-center justify-between gap-3 rounded-lg border p-3'>
            <span>
              <span className='block text-sm font-medium'>
                {t('Enable sensitive-word checks')}
              </span>
              <span className='text-muted-foreground block text-xs'>
                {t('Apply the rule snapshot to incoming prompts.')}
              </span>
            </span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(value) => update('enabled', value)}
            />
          </label>
          <label className='flex items-center justify-between gap-3 rounded-lg border p-3'>
            <span>
              <span className='block text-sm font-medium'>
                {t('Check prompt content')}
              </span>
              <span className='text-muted-foreground block text-xs'>
                {t('Inspect normalized text before token estimation.')}
              </span>
            </span>
            <Switch
              checked={draft.check_prompt}
              onCheckedChange={(value) => update('check_prompt', value)}
            />
          </label>
        </div>

        <label className='flex items-center justify-between gap-3 rounded-lg border p-3'>
          <span>
            <span className='block text-sm font-medium'>
              {t('Retain full prompt evidence')}
            </span>
            <span className='text-muted-foreground block text-xs'>
              {t(
                'Administrators can inspect evidence; user projections remain redacted.'
              )}
            </span>
          </span>
          <Switch
            checked={draft.retain_full_prompt}
            onCheckedChange={(value) => update('retain_full_prompt', value)}
          />
        </label>

        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='sensitive-ban-threshold'>
              {t('Ban threshold')}
            </Label>
            <Input
              id='sensitive-ban-threshold'
              type='number'
              min={1}
              max={1000}
              value={draft.ban_threshold}
              onChange={(event) =>
                update('ban_threshold', Number(event.target.value) || 0)
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='sensitive-retention'>
              {t('Evidence retention (days)')}
            </Label>
            <Input
              id='sensitive-retention'
              type='number'
              min={1}
              max={3650}
              value={draft.full_prompt_retention_days}
              onChange={(event) =>
                update(
                  'full_prompt_retention_days',
                  Number(event.target.value) || 0
                )
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='sensitive-prompt-limit'>
              {t('Prompt limit (characters)')}
            </Label>
            <Input
              id='sensitive-prompt-limit'
              type='number'
              min={1}
              max={65536}
              value={draft.max_prompt_runes}
              onChange={(event) =>
                update('max_prompt_runes', Number(event.target.value) || 0)
              }
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='sensitive-block-message'>{t('Block message')}</Label>
          <Textarea
            id='sensitive-block-message'
            rows={4}
            value={draft.block_message}
            onChange={(event) => update('block_message', event.target.value)}
          />
        </div>

        <div className='flex justify-end'>
          <Button type='button' onClick={() => void save()} disabled={saving}>
            {saving ? t('Saving...') : t('Save policy')}
          </Button>
        </div>
      </div>
    </SettingsCard>
  )
}
