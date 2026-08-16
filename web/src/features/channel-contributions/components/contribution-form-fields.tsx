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
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import { PasswordInput } from '@/components/password-input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelMappingEditor } from '@/features/channels/components/model-mapping-editor'

import type { ContributionFormValues } from '../form-schema'

export function ContributionFormFields(props: {
  form: UseFormReturn<ContributionFormValues>
  channelTypes: Array<{ value: number; label: string }>
  groups: string[]
  disabled: boolean
  editing: boolean
}) {
  const { t } = useTranslation()
  const models = props.form.watch('models')
  const modelOptions = models.map((model) => ({ label: model, value: model }))

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={props.form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Channel name')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={props.disabled}
                  placeholder={t('Give this contribution a recognizable name')}
                  autoComplete='off'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={props.form.control}
          name='type'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Channel type')}</FormLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => field.onChange(Number(value))}
                disabled={props.disabled}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Select channel type')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent alignItemWithTrigger={false}>
                  {props.channelTypes.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={props.form.control}
        name='base_url'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('API endpoint')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={props.disabled}
                placeholder='https://api.example.com'
                inputMode='url'
                autoComplete='url'
              />
            </FormControl>
            <FormDescription>
              {t('Use the provider base URL without a model-specific path.')}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={props.form.control}
          name='key'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('API key')}</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  disabled={props.disabled}
                  placeholder={
                    props.editing
                      ? t('Leave blank to keep the current key')
                      : t('Enter the provider API key')
                  }
                  autoComplete='new-password'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={props.form.control}
          name='group'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Group')}</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={props.disabled}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Select an allowed group')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent alignItemWithTrigger={false}>
                  {props.groups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={props.form.control}
        name='models'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Models')}</FormLabel>
            <FormControl>
              <MultiSelect
                id='channel-contribution-models'
                options={modelOptions}
                selected={field.value}
                onChange={field.onChange}
                allowCreate
                disabled={props.disabled}
                maxVisibleChips={8}
                placeholder={t('Fetch models or enter model IDs')}
                createLabel={t('Add "{{value}}"')}
                emptyText={t('No matching models')}
              />
            </FormControl>
            <FormDescription>
              {t('Up to 100 unique models can be tested in one contribution.')}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='model_mapping'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Model Mapping')}</FormLabel>
            <FormControl>
              <ModelMappingEditor
                value={field.value}
                onChange={field.onChange}
                disabled={props.disabled}
                sourceModelOptions={models}
                targetModelOptions={models}
              />
            </FormControl>
            <FormDescription>
              {t('Map public model IDs to the provider model IDs when needed.')}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
