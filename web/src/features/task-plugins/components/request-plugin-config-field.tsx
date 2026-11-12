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
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { PasswordInput } from '@/components/password-input'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toIntlLocale } from '@/i18n/languages'
import { formatBytes, formatNumber } from '@/lib/format'
import { resolveLocalizedText } from '@/lib/localized-text'
import { cn } from '@/lib/utils'

import {
  REQUEST_PLUGIN_BYTE_SCALES,
  requestPluginFieldInline,
  requestPluginFieldKind,
  requestPluginFieldUsesSlider,
  type RequestPluginBytesDraft,
  type RequestPluginFieldError,
} from '../lib/request-plugins'
import type { RequestPluginConfigField as ConfigField } from '../types'
import { RequestPluginFieldHint } from './request-plugin-field-hint'

type RequestPluginConfigFieldProps = {
  id: string
  name: string
  field: ConfigField
  value: unknown
  required?: boolean
  error?: RequestPluginFieldError
  disabled?: boolean
  /** A control placed beside the label, such as a visual editor button. */
  action?: ReactNode
  /**
   * `row` is a setting of the form: short controls sit beside the title.
   * `compact` is a field of a list item, with a small title. `cell` is a
   * table cell: the control alone, its title read by assistive technology.
   */
  layout?: 'row' | 'compact' | 'cell'
  onChange: (value: unknown) => void
}

/** One field of an instance config, rendered from its schema. */
export function RequestPluginConfigField(props: RequestPluginConfigFieldProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const field = props.field
  const title = resolveLocalizedText(field.title, i18n.language) || props.name
  const description = resolveLocalizedText(field.description, i18n.language)
  const kind = requestPluginFieldKind(field)
  const layout = props.layout ?? 'row'
  const text = typeof props.value === 'string' ? props.value : ''
  // Counted only when this text changes, not when another field does.
  const filledLines = useMemo(
    () =>
      kind === 'textarea'
        ? text.split('\n').filter((line) => line.trim()).length
        : 0,
    [kind, text]
  )
  const invalid = props.error ? true : undefined
  const error = props.error && (
    <FieldError className={layout === 'row' ? undefined : 'text-xs'}>
      {t(props.error.message, props.error.values)}
    </FieldError>
  )
  const label = (
    <>
      {title}
      {props.required && (
        <span aria-hidden='true' className='text-destructive'>
          *
        </span>
      )}
    </>
  )

  if (kind === 'boolean' && layout !== 'row') {
    return (
      <Field
        orientation={layout === 'cell' ? 'horizontal' : 'vertical'}
        className={layout === 'cell' ? 'h-8 w-auto items-center' : 'gap-1.5'}
      >
        {layout === 'cell' ? (
          <FieldLabel htmlFor={props.id} className='sr-only'>
            {title}
          </FieldLabel>
        ) : (
          <div className='flex items-center gap-1'>
            <FieldLabel htmlFor={props.id} className='text-xs'>
              {title}
            </FieldLabel>
            <RequestPluginFieldHint text={description} />
          </div>
        )}
        <Switch
          id={props.id}
          checked={props.value === true}
          disabled={props.disabled}
          onCheckedChange={props.onChange}
        />
      </Field>
    )
  }

  if (kind === 'enumList') {
    const selected = Array.isArray(props.value) ? (props.value as string[]) : []
    const options = (field.items?.enum ?? []).map((option) => String(option))
    return (
      <Field data-invalid={invalid}>
        <FieldLabel id={`${props.id}-label`}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        <ToggleGroup
          multiple
          aria-labelledby={`${props.id}-label`}
          value={selected}
          disabled={props.disabled}
          onValueChange={(next) =>
            // Keep the schema's order, whatever order they were picked in.
            props.onChange(options.filter((option) => next.includes(option)))
          }
          variant='outline'
          spacing={2}
          className='flex w-full flex-wrap gap-2'
        >
          {options.map((option, index) => (
            <ToggleGroupItem
              key={option}
              value={option}
              size='sm'
              className='data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary rounded-full px-3'
            >
              {resolveLocalizedText(
                field.items?.enumTitles?.[index],
                i18n.language
              ) || option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {error}
      </Field>
    )
  }

  let unitText = ''
  if (field.unit === 'pixel') unitText = 'px'
  if (field.unit === 'character') unitText = t('characters')
  if (field.unit === 'second') unitText = t('seconds')
  const formatBound = (value: number) => {
    if (field.unit === 'byte') return formatBytes(value, locale)
    const number = formatNumber(value, locale)
    return unitText ? `${number} ${unitText}` : number
  }
  // An address left empty uses its default, so the default is its example.
  const example =
    field.examples?.[0] ?? (field.format === 'url' ? field.default : undefined)
  let exampleText = ''
  if (example !== undefined && kind !== 'enum') {
    if (kind === 'lines' && Array.isArray(example)) {
      exampleText = example.join('\n')
    } else if (kind === 'bytes' && typeof example === 'number') {
      exampleText = formatBytes(example, locale)
    } else if (typeof example === 'object' && example !== null) {
      exampleText = JSON.stringify(example, null, 2)
    } else {
      exampleText = String(example)
    }
  }
  const slider = requestPluginFieldUsesSlider(field)
  let rangeText = ''
  if ((kind === 'number' || kind === 'bytes') && !slider) {
    if (field.minimum !== undefined && field.maximum !== undefined) {
      rangeText = t('Allowed range: {{min}} to {{max}}', {
        min: formatBound(field.minimum),
        max: formatBound(field.maximum),
      })
    } else if (field.maximum !== undefined) {
      rangeText = t('At most {{value}}', { value: formatBound(field.maximum) })
    } else if (field.minimum !== undefined && field.minimum > 0) {
      rangeText = t('At least {{value}}', { value: formatBound(field.minimum) })
    }
  }
  const numberInput = (className?: string) => (
    <Input
      id={props.id}
      type='number'
      inputMode='decimal'
      min={field.minimum}
      max={field.maximum}
      value={text}
      disabled={props.disabled}
      placeholder={exampleText}
      aria-invalid={invalid}
      className={className}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )

  let control: ReactNode
  if (kind === 'enum') {
    const items = (field.enum ?? []).map((option, index) => ({
      value: String(option),
      label:
        resolveLocalizedText(field.enumTitles?.[index], i18n.language) ||
        String(option),
    }))
    // A choice left empty uses its default, so the default stands in for it.
    const defaultItem =
      field.default === undefined
        ? undefined
        : items.find((item) => item.value === String(field.default))
    control = (
      <Select
        value={props.value === undefined ? null : String(props.value)}
        disabled={props.disabled}
        items={items}
        onValueChange={(next) =>
          props.onChange(field.enum?.find((option) => String(option) === next))
        }
      >
        <SelectTrigger id={props.id} className='w-full'>
          <SelectValue placeholder={defaultItem?.label ?? t('Not set')} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else if (kind === 'json') {
    control = (
      <JsonCodeEditor
        id={props.id}
        value={text}
        onChange={props.onChange}
        disabled={props.disabled}
        ariaLabel={title}
        aria-invalid={invalid}
        placeholder={exampleText}
        heightClassName='h-40 min-h-40 max-h-40'
      />
    )
  } else if (kind === 'textarea') {
    control = (
      <div className='space-y-1'>
        <Textarea
          id={props.id}
          value={text}
          disabled={props.disabled}
          placeholder={exampleText}
          aria-invalid={invalid}
          className='min-h-28 break-words whitespace-pre-wrap'
          onChange={(event) => props.onChange(event.target.value)}
        />
        {filledLines > 0 && (
          <p className='text-muted-foreground text-right text-xs tabular-nums'>
            {t('Lines: {{value}}', {
              value: formatNumber(filledLines, locale),
            })}
          </p>
        )}
      </div>
    )
  } else if (kind === 'lines') {
    control = (
      <Textarea
        id={props.id}
        rows={4}
        value={text}
        disabled={props.disabled}
        placeholder={exampleText}
        aria-invalid={invalid}
        className='font-mono text-xs break-all whitespace-pre-wrap'
        onChange={(event) => props.onChange(event.target.value)}
      />
    )
  } else if (kind === 'bytes') {
    const bytes = (props.value as RequestPluginBytesDraft | undefined) ?? {
      amount: '',
      scale: 1000,
    }
    control = (
      <div className='flex gap-2'>
        <Input
          id={props.id}
          type='number'
          inputMode='decimal'
          min={0}
          value={bytes.amount}
          disabled={props.disabled}
          placeholder={exampleText}
          aria-invalid={invalid}
          className='flex-1'
          onChange={(event) =>
            props.onChange({ ...bytes, amount: event.target.value })
          }
        />
        <Select
          value={String(bytes.scale)}
          disabled={props.disabled}
          items={REQUEST_PLUGIN_BYTE_SCALES.map((item) => ({
            value: String(item.scale),
            label: item.label,
          }))}
          onValueChange={(next) =>
            props.onChange({ ...bytes, scale: Number(next) })
          }
        >
          <SelectTrigger
            className='w-24'
            aria-label={t('Unit of {{name}}', { name: title })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_PLUGIN_BYTE_SCALES.map((item) => (
              <SelectItem key={item.scale} value={String(item.scale)}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  } else if (kind === 'number' && slider) {
    const number = Number(text)
    let sliderValue = Number(field.default ?? field.minimum)
    if (text.trim() && Number.isFinite(number)) sliderValue = number
    control = (
      <div className='flex items-center gap-3'>
        <Slider
          className='flex-1 py-1.5'
          min={field.minimum}
          max={field.maximum}
          step={1}
          value={[sliderValue]}
          disabled={props.disabled}
          aria-labelledby={`${props.id}-label`}
          onValueChange={(next) =>
            props.onChange(String(Array.isArray(next) ? next[0] : next))
          }
        />
        {numberInput('w-20')}
      </div>
    )
  } else if (kind === 'number' && unitText) {
    control = (
      <InputGroup>
        <InputGroupInput
          id={props.id}
          type='number'
          inputMode='decimal'
          min={field.minimum}
          max={field.maximum}
          value={text}
          disabled={props.disabled}
          placeholder={exampleText}
          aria-invalid={invalid}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <InputGroupAddon align='inline-end'>{unitText}</InputGroupAddon>
      </InputGroup>
    )
  } else if (kind === 'number') {
    control = numberInput()
  } else if (field.format === 'password') {
    control = (
      <PasswordInput
        id={props.id}
        value={text}
        disabled={props.disabled}
        placeholder={exampleText}
        autoComplete='off'
        aria-invalid={invalid}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )
  } else {
    control = (
      <Input
        id={props.id}
        value={text}
        disabled={props.disabled}
        placeholder={exampleText}
        aria-invalid={invalid}
        type={field.format === 'url' ? 'url' : 'text'}
        className={field.format === 'regex' ? 'font-mono' : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )
  }

  if (layout === 'cell') {
    return (
      <Field data-invalid={invalid} className='min-w-0 gap-1'>
        <FieldLabel
          id={`${props.id}-label`}
          htmlFor={props.id}
          className='sr-only'
        >
          {title}
        </FieldLabel>
        {control}
        {error}
      </Field>
    )
  }

  if (layout === 'compact') {
    return (
      <Field data-invalid={invalid} className='min-w-0 gap-1.5'>
        <div className='flex items-center gap-1'>
          <FieldLabel
            id={`${props.id}-label`}
            htmlFor={props.id}
            className='text-xs'
          >
            {label}
          </FieldLabel>
          <RequestPluginFieldHint text={description} />
        </div>
        {control}
        {error}
      </Field>
    )
  }

  if (requestPluginFieldInline(field)) {
    return (
      <Field
        data-invalid={invalid}
        className='gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6'
      >
        <FieldContent className='min-w-0'>
          <FieldLabel id={`${props.id}-label`} htmlFor={props.id}>
            {label}
          </FieldLabel>
          {description && <FieldDescription>{description}</FieldDescription>}
          {rangeText && <FieldDescription>{rangeText}</FieldDescription>}
          {error}
        </FieldContent>
        <div
          className={cn(
            'shrink-0 sm:w-56',
            kind === 'boolean' ? 'w-auto sm:flex sm:justify-end' : 'w-full'
          )}
        >
          {kind === 'boolean' ? (
            <Switch
              id={props.id}
              checked={props.value === true}
              disabled={props.disabled}
              onCheckedChange={props.onChange}
            />
          ) : (
            control
          )}
        </div>
      </Field>
    )
  }

  // A multi-line text shows its example as the placeholder.
  const exampleBelow = kind !== 'enum' && kind !== 'textarea'
  const multilineExample = exampleBelow && exampleText.includes('\n')
  return (
    <Field data-invalid={invalid}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <FieldLabel id={`${props.id}-label`} htmlFor={props.id}>
          {label}
        </FieldLabel>
        {props.action}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      {control}
      {rangeText && <FieldDescription>{rangeText}</FieldDescription>}
      {exampleText && exampleBelow && !multilineExample && (
        <FieldDescription>
          {t('Example: {{value}}', { value: exampleText })}
        </FieldDescription>
      )}
      {multilineExample && (
        <div className='space-y-1'>
          <span className='text-muted-foreground text-xs'>{t('Example')}</span>
          <pre className='bg-muted/40 max-h-40 overflow-auto rounded-md p-2 font-mono text-xs break-all whitespace-pre-wrap'>
            {exampleText}
          </pre>
        </div>
      )}
      {error}
    </Field>
  )
}
