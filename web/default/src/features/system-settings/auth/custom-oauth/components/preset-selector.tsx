import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OAUTH_PRESETS, type CustomOAuthFormValues } from '../types'

type PresetSelectorProps = {
  form: UseFormReturn<CustomOAuthFormValues>
}

export function PresetSelector(props: PresetSelectorProps) {
  const { t } = useTranslation()
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [baseUrl, setBaseUrl] = useState<string>('')

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey)
    const preset = OAUTH_PRESETS.find((p) => p.key === presetKey)
    if (!preset) return

    // Auto-fill name, slug, icon, and field mappings immediately
    props.form.setValue('name', preset.name, { shouldDirty: true })
    props.form.setValue('slug', presetKey.toLowerCase().replace(/\s+/g, '-'), {
      shouldDirty: true,
    })
    props.form.setValue('icon', preset.icon, { shouldDirty: true })
    props.form.setValue('scopes', preset.scopes, { shouldDirty: true })
    props.form.setValue('user_id_field', preset.user_id_field, {
      shouldDirty: true,
    })
    props.form.setValue('username_field', preset.username_field, {
      shouldDirty: true,
    })
    props.form.setValue('display_name_field', preset.display_name_field, {
      shouldDirty: true,
    })
    props.form.setValue('email_field', preset.email_field, {
      shouldDirty: true,
    })

    // Apply base URL if already entered
    if (baseUrl) {
      applyEndpoints(preset, baseUrl)
    }
  }

  const handleBaseUrlChange = (url: string) => {
    setBaseUrl(url)
    if (!selectedPreset) return

    const preset = OAUTH_PRESETS.find((p) => p.key === selectedPreset)
    if (!preset) return

    applyEndpoints(preset, url)
  }

  const applyEndpoints = (
    preset: (typeof OAUTH_PRESETS)[number],
    url: string
  ) => {
    const cleanUrl = url.replace(/\/+$/, '')
    props.form.setValue(
      'authorization_endpoint',
      cleanUrl + preset.authorization_endpoint,
      { shouldDirty: true }
    )
    props.form.setValue('token_endpoint', cleanUrl + preset.token_endpoint, {
      shouldDirty: true,
    })
    props.form.setValue(
      'user_info_endpoint',
      cleanUrl + preset.user_info_endpoint,
      { shouldDirty: true }
    )
  }

  return (
    <div className='space-y-3 rounded-lg border border-dashed p-4'>
      <p className='text-sm font-medium'>{t('Quick Setup from Preset')}</p>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label>{t('Preset Template')}</Label>
          <Select
            value={selectedPreset}
            onValueChange={(v) => v !== null && handlePresetChange(v)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Select a preset...')} />
            </SelectTrigger>
            <SelectContent>
              {OAUTH_PRESETS.map((preset) => (
                <SelectItem key={preset.key} value={preset.key}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label>{t('Base URL')}</Label>
          <Input
            placeholder={t('https://your-server.example.com')}
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
