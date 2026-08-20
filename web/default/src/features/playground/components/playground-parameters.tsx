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
import { SlidersHorizontalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from '@/components/ui/switch'
import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import type {
  MediaGenerationProfile,
  MediaGenerationSettings,
  MediaParameterField,
  MediaParameterKey,
  MediaParameterValue,
} from '../lib'

interface PlaygroundParametersProps {
  disabled?: boolean
  model: string
  profile: MediaGenerationProfile
  settings: MediaGenerationSettings
  onChange: (key: MediaParameterKey, value: MediaParameterValue) => void
}

function isFieldVisible(
  field: MediaParameterField,
  settings: MediaGenerationSettings
): boolean {
  if (field.control !== 'number' || !field.visibleWhen) return true
  return field.visibleWhen.values.includes(
    settings[field.visibleWhen.key] ?? ''
  )
}

export function PlaygroundParameters(props: PlaygroundParametersProps) {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <PromptInputButton
            className='border font-medium'
            disabled={props.disabled}
            variant='outline'
          />
        }
      >
        <SlidersHorizontalIcon size={16} />
        <span className='hidden sm:inline'>{t('Parameters')}</span>
        <span className='sr-only sm:hidden'>{t('Parameters')}</span>
      </DialogTrigger>
      <DialogContent className='max-h-[min(80vh,42rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Generation parameters')}</DialogTitle>
          <DialogDescription>
            {props.model} ·{' '}
            {props.profile.kind === 'image' ? t('Image') : t('Video')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-1 sm:grid-cols-2'>
          {props.profile.fields.map((field) => {
            if (!isFieldVisible(field, props.settings)) return null

            if (field.control === 'switch') {
              return (
                <div
                  className='border-border flex items-center justify-between rounded-lg border px-3 py-2.5 sm:col-span-2'
                  key={field.key}
                >
                  <Label htmlFor={`playground-${field.key}`}>
                    {t(field.labelKey)}
                  </Label>
                  <Switch
                    checked={Boolean(props.settings[field.key])}
                    id={`playground-${field.key}`}
                    onCheckedChange={(checked) =>
                      props.onChange(field.key, checked)
                    }
                  />
                </div>
              )
            }

            if (field.control === 'number') {
              return (
                <div className='grid gap-1.5' key={field.key}>
                  <Label htmlFor={`playground-${field.key}`}>
                    {t(field.labelKey)}
                  </Label>
                  <div className='relative'>
                    <Input
                      id={`playground-${field.key}`}
                      max={field.max}
                      min={field.min}
                      onChange={(event) =>
                        props.onChange(field.key, Number(event.target.value))
                      }
                      step={field.step}
                      type='number'
                      value={Number(props.settings[field.key] ?? field.min)}
                    />
                    {field.unitKey && (
                      <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs'>
                        {t(field.unitKey)}
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            const selectedValue = String(props.settings[field.key] ?? '')
            return (
              <div className='grid gap-1.5' key={field.key}>
                <Label htmlFor={`playground-${field.key}`}>
                  {t(field.labelKey)}
                </Label>
                <Select
                  value={selectedValue}
                  onValueChange={(value) => {
                    if (value === null) return
                    if (field.key === 'duration') {
                      props.onChange(field.key, Number(value))
                      return
                    }
                    props.onChange(field.key, value)
                  }}
                >
                  <SelectTrigger
                    className='w-full'
                    id={`playground-${field.key}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {field.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.labelKey ? t(option.labelKey) : option.value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>

        {props.profile.noteKey && (
          <p className='bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs leading-relaxed'>
            {t(props.profile.noteKey)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
