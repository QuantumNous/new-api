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
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Braces,
  ChevronRight,
  CircleHelp,
  List,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  useForm,
  useFieldArray,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { cn } from '@/lib/utils'

import {
  SettingsControlChildren,
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

// 内置出口格式：仅火山直连(AK/SK HMAC 签名)与套娃 new-api 需内置；其余协议用自定义格式模板。
const BUILTIN_FORMATS = ['volcengine', 'newapi'] as const
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const fieldMapSchema = z.object({ from: z.string(), to: z.string() })

const outboundSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.string(),
  base_url: z.string(),
  region: z.string(),
  project_name: z.string(),
  group_type: z.string(),
  access_key: z.string(),
  secret_key: z.string(),
  access_token: z.string(),
  disabled: z.boolean(),
})

const customFormatSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: z.string(),
  url_template: z.string(),
  auth_type: z.string(),
  auth_name: z.string(),
  auth_value: z.string(),
  headers: z.array(fieldMapSchema),
  request_passthrough: z.boolean(),
  request_mapping: z.array(fieldMapSchema),
  result_path: z.string(),
  error_code_path: z.string(),
  error_message_path: z.string(),
  response_mapping: z.array(fieldMapSchema),
  items_path: z.string(),
  item_mapping: z.array(fieldMapSchema),
})

const schema = z.object({
  outbounds: z.array(outboundSchema),
  default_outbound: z.string(),
  outbound_selector_header: z.string(),
  failover: z.boolean(),
  custom_formats: z.array(customFormatSchema),
  price_list_assets: z.number().int().min(0),
  price_get_asset: z.number().int().min(0),
  price_create_asset: z.number().int().min(0),
  price_update_asset: z.number().int().min(0),
  price_delete_asset: z.number().int().min(0),
  rate_limit_count: z.number().int().min(0),
  rate_limit_duration_seconds: z.number().int().min(0),
})

type AssetConfig = z.infer<typeof schema>
type Outbound = z.infer<typeof outboundSchema>
type CustomFormat = z.infer<typeof customFormatSchema>
type FieldMap = z.infer<typeof fieldMapSchema>
type OutboundTextKey =
  | 'id'
  | 'name'
  | 'base_url'
  | 'region'
  | 'project_name'
  | 'group_type'
  | 'access_key'
  | 'secret_key'
  | 'access_token'
type MappingArrayName =
  | `custom_formats.${number}.headers`
  | `custom_formats.${number}.request_mapping`
  | `custom_formats.${number}.response_mapping`
  | `custom_formats.${number}.item_mapping`

// 价格表单字段 ↔ 上游 Action 的映射。label 为可翻译的友好名称，
// action 是技术标识（保持英文，便于对应实际接口）。
const PRICE_FIELDS = [
  { name: 'price_list_assets', action: 'ListAssets', label: 'List assets' },
  { name: 'price_get_asset', action: 'GetAsset', label: 'Get asset' },
  { name: 'price_create_asset', action: 'CreateAsset', label: 'Create asset' },
  { name: 'price_update_asset', action: 'UpdateAsset', label: 'Update asset' },
  { name: 'price_delete_asset', action: 'DeleteAsset', label: 'Delete asset' },
] as const

const AUTH_TYPES = [
  { value: 'none', label: 'No auth' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'Custom header' },
  { value: 'query', label: 'Query parameter' },
] as const

// 帮助说明分节：标题 + 正文，均为可翻译键。集中维护，便于 i18n。
const HELP_SECTIONS = [
  {
    title: 'What this does',
    body: 'This connects an upstream asset-management API (Volcengine / Doubao / Seedance and compatible services). Assets are references (URLs) to the images and videos used by video generation — they organize media links and do not store the media itself. Clients always call one fixed canonical (Volcengine-style) API, and the gateway forwards each request to a configurable upstream (an outbound).',
  },
  {
    title: 'Outbounds & selection',
    body: 'An outbound is one upstream target with its own format and credentials. Pick a built-in format (Volcengine direct AK/SK, or another new-api for nesting) or a custom format. Each request uses exactly one outbound: clients select it with the selector header (default X-Asset-Outbound) or an outbound query parameter carrying the outbound ID; otherwise the default outbound is used. With failover enabled, the gateway falls back to other configured outbounds when the chosen one is unavailable.',
  },
  {
    title: 'User isolation',
    body: "Every user is automatically given a dedicated, system-managed asset group on each outbound's upstream. Users can only see and operate on assets inside their own group, so no user can read or modify another user's assets. Asset group management endpoints are restricted to administrators.",
  },
  {
    title: 'Billing & quota',
    body: 'Set a fixed quota cost per operation. 0 means free. The cost is checked before the request; on success it is deducted from both the user quota and the token quota and written to the consumption log.',
  },
  {
    title: 'Rate limiting',
    body: 'Limits how many asset API calls each user may make within a time window. Set the request count or the window to 0 to turn rate limiting off.',
  },
  {
    title: 'Custom formats',
    body: 'A custom format is a reusable adapter for an upstream the built-ins do not cover. You describe its URL, HTTP method, auth, static headers and the JSON field mapping for requests and responses. Templates support placeholders like {base_url}, {action}, {access_token}, {access_key}, {secret_key}, {project_name}, {region} and {uuid}. Once saved, a custom format appears as a selectable option in each outbound. The "Gateway preset" gives you a ready-made Volcengine-compatible gateway you can tweak.',
  },
  {
    title: 'Credential safety',
    body: 'Secret Key and Access Token are write-only: they are masked when loaded and never sent back to the browser. Leave them blank to keep the existing values; enter a new value only when you want to replace them.',
  },
] as const

// 模板占位符参考。token 为代码标识（不翻译），desc 为可翻译说明。
// 与后端 assetTemplateContext / applyAssetTemplate 保持一致。
const PLACEHOLDERS = [
  {
    token: '{base_url}',
    desc: "The outbound's Base URL (trailing slash removed)",
  },
  {
    token: '{action}',
    desc: 'The operation name: ListAssets, GetAsset, CreateAsset, UpdateAsset or DeleteAsset',
  },
  { token: '{access_key}', desc: "The outbound's Access Key" },
  { token: '{secret_key}', desc: "The outbound's Secret Key" },
  { token: '{access_token}', desc: "The outbound's Access Token" },
  { token: '{project_name}', desc: "The outbound's Project Name" },
  { token: '{region}', desc: "The outbound's Region (default cn-beijing)" },
  { token: '{group_type}', desc: "The outbound's Group Type (default AIGC)" },
  { token: '{uuid}', desc: 'A fresh random UUID generated for each request' },
  {
    token: '{field:<path>}',
    desc: 'A value pulled from the incoming request body by JSON path, e.g. {field:Id} or {field:Filter.GroupIds.0}',
  },
] as const

function newOutbound(): Outbound {
  return {
    id: '',
    name: '',
    format: 'volcengine',
    base_url: '',
    region: '',
    project_name: '',
    group_type: '',
    access_key: '',
    secret_key: '',
    access_token: '',
    disabled: false,
  }
}

function blankCustomFormat(): CustomFormat {
  return {
    id: '',
    name: '',
    method: 'POST',
    url_template: '{base_url}/{action}',
    auth_type: 'bearer',
    auth_name: '',
    auth_value: '{access_token}',
    headers: [],
    request_passthrough: true,
    request_mapping: [],
    result_path: 'data',
    error_code_path: 'code',
    error_message_path: 'message',
    response_mapping: [],
    items_path: '',
    item_mapping: [],
  }
}

// gatewayPresetFormat 是“火山兼容网关（X-Access-Token）”的现成模板，等价于旧的内置 token 类型。
function gatewayPresetFormat(): CustomFormat {
  return {
    id: 'volc-gateway',
    name: 'Volcengine-compatible gateway',
    method: 'POST',
    url_template: '{base_url}?Action={action}',
    auth_type: 'header',
    auth_name: 'X-Access-Token',
    auth_value: '{access_token}',
    headers: [{ from: 'X-Track-Id', to: '{uuid}' }],
    request_passthrough: true,
    request_mapping: [],
    result_path: 'Result',
    error_code_path: 'Code',
    error_message_path: 'Message',
    response_mapping: [],
    items_path: '',
    item_mapping: [],
  }
}

function toNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseRows(v: unknown): FieldMap[] {
  if (!Array.isArray(v)) return []
  return v.map((r) => ({
    from: toStr((r as Record<string, unknown>).from),
    to: toStr((r as Record<string, unknown>).to),
  }))
}

function parseOutbound(raw: Record<string, unknown>): Outbound {
  return {
    id: toStr(raw.id),
    name: toStr(raw.name),
    format: toStr(raw.format) || 'volcengine',
    base_url: toStr(raw.base_url),
    region: toStr(raw.region),
    project_name: toStr(raw.project_name),
    group_type: toStr(raw.group_type),
    access_key: toStr(raw.access_key),
    secret_key: toStr(raw.secret_key),
    access_token: toStr(raw.access_token),
    disabled: raw.disabled === true,
  }
}

function parseCustomFormat(raw: Record<string, unknown>): CustomFormat {
  const auth = (raw.auth ?? {}) as Record<string, unknown>
  const headersObj = (raw.headers ?? {}) as Record<string, unknown>
  return {
    id: toStr(raw.id),
    name: toStr(raw.name),
    method: toStr(raw.method) || 'POST',
    url_template: toStr(raw.url_template),
    auth_type: toStr(auth.type) || 'none',
    auth_name: toStr(auth.name),
    auth_value: toStr(auth.value),
    headers: Object.entries(headersObj).map(([k, v]) => ({
      from: k,
      to: toStr(v),
    })),
    request_passthrough: raw.request_passthrough === true,
    request_mapping: parseRows(raw.request_mapping),
    result_path: toStr(raw.result_path),
    error_code_path: toStr(raw.error_code_path),
    error_message_path: toStr(raw.error_message_path),
    response_mapping: parseRows(raw.response_mapping),
    items_path: toStr(raw.items_path),
    item_mapping: parseRows(raw.item_mapping),
  }
}

function parseConfig(raw: string): AssetConfig {
  const empty: AssetConfig = {
    outbounds: [],
    default_outbound: '',
    outbound_selector_header: '',
    failover: false,
    custom_formats: [],
    price_list_assets: 0,
    price_get_asset: 0,
    price_create_asset: 0,
    price_update_asset: 0,
    price_delete_asset: 0,
    rate_limit_count: 0,
    rate_limit_duration_seconds: 0,
  }
  if (!raw) return empty

  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const prices = (obj.action_prices ?? {}) as Record<string, unknown>

    return {
      outbounds: Array.isArray(obj.outbounds)
        ? (obj.outbounds as Record<string, unknown>[]).map(parseOutbound)
        : [],
      default_outbound: toStr(obj.default_outbound),
      outbound_selector_header: toStr(obj.outbound_selector_header),
      failover: obj.failover === true,
      custom_formats: Array.isArray(obj.custom_formats)
        ? (obj.custom_formats as Record<string, unknown>[]).map(
            parseCustomFormat
          )
        : [],
      price_list_assets: toNumber(prices.ListAssets),
      price_get_asset: toNumber(prices.GetAsset),
      price_create_asset: toNumber(prices.CreateAsset),
      price_update_asset: toNumber(prices.UpdateAsset),
      price_delete_asset: toNumber(prices.DeleteAsset),
      rate_limit_count: toNumber(obj.rate_limit_count),
      rate_limit_duration_seconds: toNumber(obj.rate_limit_duration_seconds),
    }
  } catch {
    return empty
  }
}

function rowsToBackend(rows: FieldMap[]) {
  const out = rows
    .map((r) => ({ from: r.from.trim(), to: r.to.trim() }))
    .filter((r) => r.from && r.to)
  return out.length > 0 ? out : undefined
}

function headersToBackend(rows: FieldMap[]) {
  const obj: Record<string, string> = {}
  for (const r of rows) {
    const key = r.from.trim()
    if (key) obj[key] = r.to
  }
  return Object.keys(obj).length > 0 ? obj : undefined
}

function customFormatToBackend(cf: CustomFormat) {
  return {
    id: cf.id.trim(),
    name: cf.name.trim() || undefined,
    method: cf.method || undefined,
    url_template: cf.url_template.trim() || undefined,
    auth: {
      type: cf.auth_type || 'none',
      name: cf.auth_name.trim() || undefined,
      value: cf.auth_value || undefined,
    },
    headers: headersToBackend(cf.headers),
    request_passthrough: cf.request_passthrough || undefined,
    request_mapping: rowsToBackend(cf.request_mapping),
    result_path: cf.result_path.trim() || undefined,
    error_code_path: cf.error_code_path.trim() || undefined,
    error_message_path: cf.error_message_path.trim() || undefined,
    items_path: cf.items_path.trim() || undefined,
    item_mapping: rowsToBackend(cf.item_mapping),
    response_mapping: rowsToBackend(cf.response_mapping),
  }
}

// useCollapseState 维护一组可折叠条目的展开状态：默认全部折叠，新增项自动展开。
function useCollapseState(fields: { id: string }[]) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const initialized = useRef(false)
  const prevCount = useRef(0)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      prevCount.current = fields.length
      return
    }
    if (fields.length > prevCount.current) {
      const newId = fields.at(-1)?.id
      if (newId) {
        setOpenIds((prev) => new Set(prev).add(newId))
      }
    }
    prevCount.current = fields.length
  }, [fields])

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  return { openIds, toggle }
}

function SubsectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-2'>
      <div className='space-y-0.5'>
        <h4 className='text-sm font-medium'>{title}</h4>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
      {action ? <div className='flex items-center gap-2'>{action}</div> : null}
    </div>
  )
}

function CollapsibleRowHeader({
  open,
  title,
  subtitle,
  onToggle,
  disabled,
  onToggleEnabled,
  onRemove,
}: {
  open: boolean
  title: string
  subtitle: string
  onToggle: () => void
  disabled?: boolean
  onToggleEnabled?: (checked: boolean) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={onToggle}
        aria-expanded={open}
        className='flex min-w-0 flex-1 items-center gap-2 text-left'
      >
        <ChevronRight
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className='min-w-0'>
          <span className='block truncate text-sm font-medium'>{title}</span>
          <span className='text-muted-foreground block truncate font-mono text-xs'>
            {subtitle}
          </span>
        </span>
      </button>
      {onToggleEnabled ? (
        <Switch
          checked={!disabled}
          aria-label={t('Enabled')}
          onCheckedChange={onToggleEnabled}
        />
      ) : null}
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='text-destructive hover:text-destructive size-8'
        onClick={onRemove}
        aria-label={t('Remove')}
      >
        <Trash2 className='size-4' />
      </Button>
    </div>
  )
}

function PlaceholderHelpDialog() {
  const { t } = useTranslation()
  return (
    <Dialog
      title={t('Template placeholders')}
      description={t(
        'Use these in the URL template, auth value and static header values. Field mappings use plain JSON paths, not placeholders.'
      )}
      trigger={
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground gap-1.5'
        >
          <CircleHelp className='size-4' />
          {t('Placeholders')}
        </Button>
      }
    >
      <div className='space-y-2 text-sm'>
        {PLACEHOLDERS.map((p) => (
          <div
            key={p.token}
            className='grid grid-cols-[minmax(7rem,auto)_1fr] items-start gap-x-3 gap-y-1'
          >
            <code className='text-foreground bg-muted h-fit rounded px-1.5 py-0.5 font-mono text-xs'>
              {p.token}
            </code>
            <span className='text-muted-foreground'>{t(p.desc)}</span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function VolcAssetHelpDialog() {
  const { t } = useTranslation()
  return (
    <Dialog
      title={t('Volcengine Assets — configuration guide')}
      description={t(
        'How user isolation, billing, rate limiting and credentials fit together.'
      )}
      trigger={
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground gap-1.5'
          aria-label={t('How it works')}
        >
          <CircleHelp className='size-4' />
          {t('How it works')}
        </Button>
      }
    >
      <div className='space-y-4 text-sm'>
        {HELP_SECTIONS.map((section) => (
          <section key={section.title} className='space-y-1'>
            <h5 className='text-foreground font-medium'>{t(section.title)}</h5>
            <p className='text-muted-foreground leading-relaxed'>
              {t(section.body)}
            </p>
          </section>
        ))}
      </div>
    </Dialog>
  )
}

function OutboundTextField({
  form,
  index,
  fieldKey,
  label,
  placeholder,
  description,
  type,
  className,
}: {
  form: UseFormReturn<AssetConfig>
  index: number
  fieldKey: OutboundTextKey
  label: string
  placeholder?: string
  description?: string
  type?: string
  className?: string
}) {
  return (
    <FormField
      control={form.control}
      name={`outbounds.${index}.${fieldKey}` as FieldPath<AssetConfig>}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              autoComplete='off'
              type={type}
              placeholder={placeholder}
              {...field}
              value={(field.value as string) ?? ''}
            />
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function OutboundGroup({
  form,
  index,
  customFormatIds,
  open,
  onToggle,
  onRemove,
}: {
  form: UseFormReturn<AssetConfig>
  index: number
  customFormatIds: string[]
  open: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const format = form.watch(`outbounds.${index}.format`)
  const name = form.watch(`outbounds.${index}.name`)
  const id = form.watch(`outbounds.${index}.id`)
  const baseUrl = form.watch(`outbounds.${index}.base_url`)
  const disabled = form.watch(`outbounds.${index}.disabled`)

  const isCustom = !BUILTIN_FORMATS.includes(
    format as (typeof BUILTIN_FORMATS)[number]
  )
  const showAkSk = format === 'volcengine' || isCustom
  const showToken = format === 'newapi' || isCustom
  const showBaseUrl = format !== 'volcengine'
  const showRegion = format === 'volcengine' || isCustom

  const title = name || id || `${t('Outbound')} ${index + 1}`
  const subtitle = baseUrl ? `${format} · ${baseUrl}` : format

  return (
    <SettingsControlGroup className={cn(disabled && 'opacity-60')}>
      <CollapsibleRowHeader
        open={open}
        title={title}
        subtitle={subtitle}
        onToggle={onToggle}
        disabled={disabled}
        onToggleEnabled={(v) =>
          form.setValue(`outbounds.${index}.disabled`, !v, {
            shouldDirty: true,
          })
        }
        onRemove={onRemove}
      />

      {open ? (
        <SettingsControlChildren className='grid gap-4 md:grid-cols-2'>
          <OutboundTextField
            form={form}
            index={index}
            fieldKey='id'
            label={t('Outbound ID')}
            placeholder='default'
          />
          <OutboundTextField
            form={form}
            index={index}
            fieldKey='name'
            label={t('Name')}
          />

          <FormField
            control={form.control}
            name={`outbounds.${index}.format`}
            render={({ field }) => (
              <FormItem className='md:col-span-2'>
                <FormLabel>{t('Outbound format')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className='w-auto min-w-(--anchor-width)'
                  >
                    <SelectGroup>
                      <SelectItem value='volcengine'>
                        {t('Volcengine Direct (AK/SK)')}
                      </SelectItem>
                      <SelectItem value='newapi'>
                        {t('new-api (nested)')}
                      </SelectItem>
                      {customFormatIds.map((cid) => (
                        <SelectItem key={cid} value={cid}>
                          {cid}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Built-in formats, plus any custom format you define below'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {showBaseUrl ? (
            <OutboundTextField
              form={form}
              index={index}
              fieldKey='base_url'
              label={t('Base URL')}
              placeholder='https://asset.example.com/api/asset-management'
              className='md:col-span-2'
            />
          ) : null}

          {showAkSk ? (
            <>
              <OutboundTextField
                form={form}
                index={index}
                fieldKey='access_key'
                label={t('Access Key')}
                placeholder='AKLT...'
              />
              <OutboundTextField
                form={form}
                index={index}
                fieldKey='secret_key'
                label={t('Secret Key')}
                type='password'
                placeholder={t('Enter new value to update')}
                description={t('Leave blank to keep the existing credential')}
              />
            </>
          ) : null}

          {showToken ? (
            <OutboundTextField
              form={form}
              index={index}
              fieldKey='access_token'
              label={t('Access Token')}
              type='password'
              placeholder={t('Enter new value to update')}
              description={t('Leave blank to keep the existing credential')}
            />
          ) : null}

          {showRegion ? (
            <OutboundTextField
              form={form}
              index={index}
              fieldKey='region'
              label={t('Region')}
              placeholder='cn-beijing'
              description={t('Defaults to cn-beijing')}
            />
          ) : null}

          <OutboundTextField
            form={form}
            index={index}
            fieldKey='project_name'
            label={t('Project Name')}
            placeholder='default'
            description={t('Optional, leave blank to use default')}
          />

          <OutboundTextField
            form={form}
            index={index}
            fieldKey='group_type'
            label={t('Group Type')}
            placeholder='AIGC'
            description={t('Defaults to AIGC')}
          />
        </SettingsControlChildren>
      ) : null}
    </SettingsControlGroup>
  )
}

function MappingList({
  form,
  name,
  label,
  fromPlaceholder,
  toPlaceholder,
  addLabel,
}: {
  form: UseFormReturn<AssetConfig>
  name: MappingArrayName
  label: string
  fromPlaceholder: string
  toPlaceholder: string
  addLabel: string
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name,
  })
  return (
    <div className='space-y-2 md:col-span-2'>
      <FormLabel>{label}</FormLabel>
      {fields.map((f, i) => (
        <div key={f.id} className='flex items-center gap-2'>
          <Input
            autoComplete='off'
            className='flex-1 font-mono text-xs'
            placeholder={fromPlaceholder}
            {...form.register(`${name}.${i}.from` as FieldPath<AssetConfig>)}
          />
          <span className='text-muted-foreground shrink-0'>→</span>
          <Input
            autoComplete='off'
            className='flex-1 font-mono text-xs'
            placeholder={toPlaceholder}
            {...form.register(`${name}.${i}.to` as FieldPath<AssetConfig>)}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-destructive hover:text-destructive size-8 shrink-0'
            onClick={() => remove(i)}
            aria-label={addLabel}
          >
            <Trash2 className='size-4' />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='gap-1.5'
        onClick={() => append({ from: '', to: '' })}
      >
        <Plus className='size-4' />
        {addLabel}
      </Button>
    </div>
  )
}

function CustomFormatTextField({
  form,
  index,
  fieldKey,
  label,
  placeholder,
  description,
  className,
  mono,
}: {
  form: UseFormReturn<AssetConfig>
  index: number
  fieldKey: keyof CustomFormat
  label: string
  placeholder?: string
  description?: string
  className?: string
  mono?: boolean
}) {
  return (
    <FormField
      control={form.control}
      name={`custom_formats.${index}.${fieldKey}` as FieldPath<AssetConfig>}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              autoComplete='off'
              className={mono ? 'font-mono text-xs' : undefined}
              placeholder={placeholder}
              {...field}
              value={(field.value as string) ?? ''}
            />
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CustomFormatGroup({
  form,
  index,
  open,
  onToggle,
  onRemove,
}: {
  form: UseFormReturn<AssetConfig>
  index: number
  open: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const id = form.watch(`custom_formats.${index}.id`)
  const name = form.watch(`custom_formats.${index}.name`)
  const method = form.watch(`custom_formats.${index}.method`)
  const url = form.watch(`custom_formats.${index}.url_template`)
  const authType = form.watch(`custom_formats.${index}.auth_type`)
  const passthrough = form.watch(`custom_formats.${index}.request_passthrough`)

  const title = name || id || `${t('Custom format')} ${index + 1}`
  const subtitle = `${method} · ${url || '{base_url}/{action}'}`

  return (
    <SettingsControlGroup>
      <CollapsibleRowHeader
        open={open}
        title={title}
        subtitle={subtitle}
        onToggle={onToggle}
        onRemove={onRemove}
      />

      {open ? (
        <SettingsControlChildren className='grid gap-4 md:grid-cols-2'>
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='id'
            label={t('Format ID')}
            placeholder='my-rest'
            description={t('Referenced by an outbound as its format')}
          />
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='name'
            label={t('Name')}
          />

          <FormField
            control={form.control}
            name={`custom_formats.${index}.method`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('HTTP method')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className='w-auto min-w-(--anchor-width)'
                  >
                    <SelectGroup>
                      {HTTP_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='url_template'
            label={t('URL template')}
            placeholder='{base_url}/{action}'
            mono
          />

          <h5 className='text-muted-foreground text-xs font-medium tracking-wide uppercase md:col-span-2'>
            {t('Authentication')}
          </h5>
          <FormField
            control={form.control}
            name={`custom_formats.${index}.auth_type`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Auth type')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className='w-auto min-w-(--anchor-width)'
                  >
                    <SelectGroup>
                      {AUTH_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {t(a.label)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {authType === 'header' || authType === 'query' ? (
            <CustomFormatTextField
              form={form}
              index={index}
              fieldKey='auth_name'
              label={t('Auth name')}
              placeholder='X-Access-Token'
              mono
            />
          ) : (
            <div className='hidden md:block' />
          )}
          {authType !== 'none' ? (
            <CustomFormatTextField
              form={form}
              index={index}
              fieldKey='auth_value'
              label={t('Auth value')}
              placeholder='{access_token}'
              description={t('Supports placeholders like {access_token}')}
              mono
              className='md:col-span-2'
            />
          ) : null}

          <MappingList
            form={form}
            name={`custom_formats.${index}.headers`}
            label={t('Static headers')}
            fromPlaceholder={t('Header name')}
            toPlaceholder={t('Header value')}
            addLabel={t('Add header')}
          />

          <h5 className='text-muted-foreground text-xs font-medium tracking-wide uppercase md:col-span-2'>
            {t('Request')}
          </h5>
          <FormField
            control={form.control}
            name={`custom_formats.${index}.request_passthrough`}
            render={({ field }) => (
              <SettingsSwitchField
                className='md:col-span-2'
                label={t('Pass through request body')}
                description={t(
                  'Send the canonical request body to the upstream unchanged'
                )}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {!passthrough ? (
            <MappingList
              form={form}
              name={`custom_formats.${index}.request_mapping`}
              label={t('Request field mapping')}
              fromPlaceholder={t('Canonical field (e.g. PageSize)')}
              toPlaceholder={t('Upstream field (e.g. page_size)')}
              addLabel={t('Add mapping')}
            />
          ) : null}

          <h5 className='text-muted-foreground text-xs font-medium tracking-wide uppercase md:col-span-2'>
            {t('Response')}
          </h5>
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='result_path'
            label={t('Result path')}
            placeholder='data'
            description={t('Where the result sits in the upstream response')}
            mono
          />
          <div className='hidden md:block' />
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='error_code_path'
            label={t('Error code path')}
            placeholder='code'
            mono
          />
          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='error_message_path'
            label={t('Error message path')}
            placeholder='message'
            mono
          />
          <MappingList
            form={form}
            name={`custom_formats.${index}.response_mapping`}
            label={t('Response field mapping')}
            fromPlaceholder={t('Upstream field (e.g. id)')}
            toPlaceholder={t('Canonical field (e.g. Id)')}
            addLabel={t('Add mapping')}
          />

          <CustomFormatTextField
            form={form}
            index={index}
            fieldKey='items_path'
            label={t('Items path (for list responses)')}
            placeholder='list'
            description={t('Path to the array inside the result, if any')}
            mono
            className='md:col-span-2'
          />
          <MappingList
            form={form}
            name={`custom_formats.${index}.item_mapping`}
            label={t('List item mapping')}
            fromPlaceholder={t('Upstream field (e.g. id)')}
            toPlaceholder={t('Canonical field (e.g. Id)')}
            addLabel={t('Add mapping')}
          />
        </SettingsControlChildren>
      ) : null}
    </SettingsControlGroup>
  )
}

export function VolcAssetSettingsSection({
  defaultValues,
}: {
  defaultValues: { VolcAssetConfig: string }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const parsed = useMemo(
    () => parseConfig(defaultValues.VolcAssetConfig),
    [defaultValues.VolcAssetConfig]
  )

  const form = useForm<AssetConfig>({
    resolver: zodResolver(schema),
    defaultValues: parsed,
  })

  useResetForm(form, parsed)

  const outboundArray = useFieldArray({
    control: form.control,
    name: 'outbounds',
  })
  const formatArray = useFieldArray({
    control: form.control,
    name: 'custom_formats',
  })

  const outboundCollapse = useCollapseState(outboundArray.fields)
  const formatCollapse = useCollapseState(formatArray.fields)

  // 自定义格式支持两种视图：可视化表单与原始 JSON。JSON 合法时实时同步回结构化表单。
  const [formatView, setFormatView] = useState<'visual' | 'json'>('visual')
  const [formatJson, setFormatJson] = useState('[]')
  const [formatJsonError, setFormatJsonError] = useState<string | null>(null)

  const showFormatJson = () => {
    setFormatJson(
      JSON.stringify(
        form.getValues('custom_formats').map(customFormatToBackend),
        null,
        2
      )
    )
    setFormatJsonError(null)
    setFormatView('json')
  }

  const applyFormatJson = (text: string) => {
    setFormatJson(text)
    try {
      const arr = JSON.parse(text)
      if (!Array.isArray(arr)) throw new Error('not an array')
      formatArray.replace(
        (arr as Record<string, unknown>[]).map(parseCustomFormat)
      )
      setFormatJsonError(null)
    } catch {
      setFormatJsonError(t('Invalid JSON'))
    }
  }

  const customFormatsVisual =
    formatArray.fields.length === 0 ? (
      <button
        type='button'
        onClick={() => formatArray.append(blankCustomFormat())}
        className='text-muted-foreground hover:border-primary/50 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm transition-colors'
      >
        <Plus className='size-4' />
        {t('No custom formats yet')}
      </button>
    ) : (
      formatArray.fields.map((f, index) => (
        <CustomFormatGroup
          key={f.id}
          form={form}
          index={index}
          open={formatCollapse.openIds.has(f.id)}
          onToggle={() => formatCollapse.toggle(f.id)}
          onRemove={() => formatArray.remove(index)}
        />
      ))
    )

  const { isDirty } = form.formState
  const outbounds = form.watch('outbounds')
  const customFormats = form.watch('custom_formats')

  const customFormatIds = useMemo(
    () =>
      (customFormats ?? [])
        .map((c) => (c.id || '').trim())
        .filter((id) => id.length > 0),
    [customFormats]
  )

  const outboundIds = useMemo(
    () =>
      (outbounds ?? [])
        .map((o) => (o.id || '').trim())
        .filter((id) => id.length > 0),
    [outbounds]
  )

  const onSubmit = async (values: AssetConfig) => {
    const payload = JSON.stringify({
      outbounds: values.outbounds.map((o) => ({
        id: o.id.trim(),
        name: o.name.trim(),
        format: o.format,
        base_url: o.base_url.trim(),
        region: o.region.trim(),
        project_name: o.project_name.trim(),
        group_type: o.group_type.trim(),
        access_key: o.access_key.trim(),
        secret_key: o.secret_key.trim(),
        access_token: o.access_token.trim(),
        disabled: o.disabled,
      })),
      default_outbound: values.default_outbound.trim(),
      outbound_selector_header: values.outbound_selector_header.trim(),
      failover: values.failover,
      custom_formats: values.custom_formats.map(customFormatToBackend),
      action_prices: {
        ListAssets: values.price_list_assets,
        GetAsset: values.price_get_asset,
        CreateAsset: values.price_create_asset,
        UpdateAsset: values.price_update_asset,
        DeleteAsset: values.price_delete_asset,
      },
      rate_limit_count: values.rate_limit_count,
      rate_limit_duration_seconds: values.rate_limit_duration_seconds,
    })

    await updateOption.mutateAsync({ key: 'VolcAssetConfig', value: payload })
    // 不在表单中保留密钥明文，保存后清空各出口的密钥输入框。
    form.reset({
      ...values,
      outbounds: values.outbounds.map((o) => ({
        ...o,
        secret_key: '',
        access_token: '',
      })),
    })
  }

  return (
    <SettingsSection title={t('Volcengine Assets')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={!isDirty}
            saveLabel='Save asset settings'
          />

          <SubsectionHeading
            title={t('Outbounds')}
            description={t('Upstream targets this gateway forwards to')}
            action={
              <>
                <VolcAssetHelpDialog />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => outboundArray.append(newOutbound())}
                >
                  <Plus className='size-4' />
                  {t('Add outbound')}
                </Button>
              </>
            }
          />

          {outboundArray.fields.length === 0 ? (
            <button
              type='button'
              onClick={() => outboundArray.append(newOutbound())}
              className='text-muted-foreground hover:border-primary/50 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm transition-colors'
            >
              <Plus className='size-4' />
              {t('No outbounds configured yet')}
            </button>
          ) : (
            outboundArray.fields.map((f, index) => (
              <OutboundGroup
                key={f.id}
                form={form}
                index={index}
                customFormatIds={customFormatIds}
                open={outboundCollapse.openIds.has(f.id)}
                onToggle={() => outboundCollapse.toggle(f.id)}
                onRemove={() => outboundArray.remove(index)}
              />
            ))
          )}

          <Separator />

          <SubsectionHeading
            title={t('Routing & selection')}
            description={t('How each request picks an outbound')}
          />

          <FormField
            control={form.control}
            name='default_outbound'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Default outbound')}</FormLabel>
                <Select
                  value={field.value || '__auto__'}
                  onValueChange={(v) =>
                    field.onChange(v === '__auto__' ? '' : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className='w-auto min-w-(--anchor-width)'
                  >
                    <SelectGroup>
                      <SelectItem value='__auto__'>
                        {t('Auto (first configured)')}
                      </SelectItem>
                      {outboundIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('Used when the client does not specify an outbound')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='outbound_selector_header'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Outbound selector header')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder='X-Asset-Outbound'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Clients send this header with an outbound ID to pick a target'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='failover'
            render={({ field }) => (
              <SettingsSwitchField
                label={t('Enable failover')}
                description={t(
                  'Fall back to other configured outbounds when the selected one is unavailable'
                )}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          <Separator />

          <SubsectionHeading
            title={t('Custom outbound formats')}
            description={t('Adapters for upstreams the built-ins do not cover')}
            action={
              <>
                {formatView === 'visual' ? (
                  <>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='gap-1.5'
                      onClick={() => formatArray.append(gatewayPresetFormat())}
                    >
                      <Wand2 className='size-4' />
                      {t('Gateway preset')}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='gap-1.5'
                      onClick={() => formatArray.append(blankCustomFormat())}
                    >
                      <Plus className='size-4' />
                      {t('Add format')}
                    </Button>
                  </>
                ) : null}
                <PlaceholderHelpDialog />
                <div className='bg-muted inline-flex rounded-lg p-0.5'>
                  <Button
                    type='button'
                    size='sm'
                    variant={formatView === 'visual' ? 'secondary' : 'ghost'}
                    className='h-7 gap-1.5'
                    onClick={() => setFormatView('visual')}
                  >
                    <List className='size-4' />
                    {t('Visual')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant={formatView === 'json' ? 'secondary' : 'ghost'}
                    className='h-7 gap-1.5'
                    onClick={showFormatJson}
                  >
                    <Braces className='size-4' />
                    JSON
                  </Button>
                </div>
              </>
            }
          />

          <Alert>
            <AlertDescription>
              {t(
                'Optional and advanced — most setups do not need this. The built-in formats are Volcengine direct (AK/SK) and nested new-api; for those you only fill in credentials. A custom format is a do-it-yourself adapter for any other upstream: describe its URL, method, auth, headers and the JSON field mapping for requests and responses. Use the Gateway preset for a ready-made Volcengine-compatible gateway. Saved formats appear in the Outbound format dropdown above.'
              )}
            </AlertDescription>
          </Alert>

          {formatView === 'json' ? (
            <div className='space-y-2'>
              <Textarea
                rows={16}
                spellCheck={false}
                className='font-mono text-xs'
                value={formatJson}
                onChange={(e) => applyFormatJson(e.target.value)}
              />
              {formatJsonError ? (
                <p className='text-destructive text-sm'>{formatJsonError}</p>
              ) : (
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Edits sync with the visual editor when the JSON is valid'
                  )}
                </p>
              )}
            </div>
          ) : (
            customFormatsVisual
          )}

          <Separator />

          <SubsectionHeading
            title={t('Per-operation billing (quota)')}
            description={t(
              'Fixed quota charged per asset operation. 0 means free; on success it is deducted from the user and token quota and written to the consume log.'
            )}
          />

          {PRICE_FIELDS.map((priceField) => (
            <FormField
              key={priceField.name}
              control={form.control}
              name={priceField.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{`${t(priceField.label)} (${priceField.action})`}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <Separator />

          <SubsectionHeading
            title={t('Asset API rate limit (per user)')}
            description={t(
              'Per-user limit on asset API calls. Set requests or window to 0 to disable.'
            )}
          />

          <FormField
            control={form.control}
            name='rate_limit_count'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Max requests')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='rate_limit_duration_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Time window (seconds)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
