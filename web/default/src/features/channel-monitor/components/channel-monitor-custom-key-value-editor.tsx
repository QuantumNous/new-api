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
import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  useFieldArray,
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import {
  MAX_CUSTOM_UPSTREAM_ENTRIES,
  type UpstreamConfigFormValues,
} from '../lib/schema'

type CustomMetricName = 'ratio' | 'balance'
type CustomKeyValueArrayName =
  | `customConfig.${CustomMetricName}.request.query`
  | `customConfig.${CustomMetricName}.request.headers`
  | `customConfig.${CustomMetricName}.request.form`

type ChannelMonitorCustomKeyValueEditorProps = {
  form: UseFormReturn<UpstreamConfigFormValues>
  name: CustomKeyValueArrayName
  label: string
}

type ChannelMonitorCustomKeyValueRowProps =
  ChannelMonitorCustomKeyValueEditorProps & {
    index: number
    onRemove: () => void
  }

function fieldName(value: string): FieldPath<UpstreamConfigFormValues> {
  return value as FieldPath<UpstreamConfigFormValues>
}

function ChannelMonitorCustomKeyValueRow(
  props: ChannelMonitorCustomKeyValueRowProps
) {
  const secret = useWatch({
    control: props.form.control,
    name: fieldName(`${props.name}.${props.index}.secret`),
  })
  const hasValue = useWatch({
    control: props.form.control,
    name: fieldName(`${props.name}.${props.index}.hasValue`),
  })

  return (
    <div className='grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto_auto] items-start gap-2'>
      <FormField
        control={props.form.control}
        name={fieldName(`${props.name}.${props.index}.key`)}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                placeholder='名称'
                value={typeof field.value === 'string' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={field.onChange}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={props.form.control}
        name={fieldName(`${props.name}.${props.index}.value`)}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type={secret === true ? 'password' : 'text'}
                placeholder={hasValue === true ? '已配置，留空保持不变' : '值'}
                autoComplete='off'
                value={typeof field.value === 'string' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={field.onChange}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={props.form.control}
        name={fieldName(`${props.name}.${props.index}.secret`)}
        render={({ field }) => (
          <FormItem className='flex h-9 items-center gap-1.5'>
            <FormControl>
              <Switch
                checked={field.value === true}
                onCheckedChange={field.onChange}
                aria-label={`${props.label} ${props.index + 1} 使用敏感值`}
              />
            </FormControl>
            <span className='text-muted-foreground text-xs'>敏感</span>
          </FormItem>
        )}
      />
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        onClick={props.onRemove}
        aria-label={`删除${props.label} ${props.index + 1}`}
      >
        <HugeiconsIcon icon={Delete02Icon} aria-hidden='true' />
      </Button>
    </div>
  )
}

export function ChannelMonitorCustomKeyValueEditor(
  props: ChannelMonitorCustomKeyValueEditorProps
) {
  const entries = useFieldArray<
    UpstreamConfigFormValues,
    CustomKeyValueArrayName
  >({
    control: props.form.control,
    name: props.name,
  })

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-sm font-medium'>{props.label}</span>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={entries.fields.length >= MAX_CUSTOM_UPSTREAM_ENTRIES}
          onClick={() =>
            entries.append({
              key: '',
              value: '',
              secret: false,
              hasValue: false,
            })
          }
        >
          <HugeiconsIcon
            icon={Add01Icon}
            data-icon='inline-start'
            aria-hidden='true'
          />
          添加
        </Button>
      </div>
      {entries.fields.length === 0 ? (
        <span className='text-muted-foreground text-sm'>未配置</span>
      ) : (
        <div className='flex flex-col gap-2'>
          {entries.fields.map((entry, index) => (
            <ChannelMonitorCustomKeyValueRow
              key={entry.id}
              form={props.form}
              name={props.name}
              label={props.label}
              index={index}
              onRemove={() => entries.remove(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
