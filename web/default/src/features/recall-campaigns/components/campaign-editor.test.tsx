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
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createFormControl, type UseFormReturn } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import * as recallApi from '../api'
import { recallLocalDateTimeToUnix } from '../audience-inputs'
import {
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  RECALL_EMAIL_STARTER_HTML,
} from '../helpers'
import type {
  RecallAudienceTemplate,
  RecallCampaignDraft,
  RecallTranslationTask,
} from '../types'

const commonHelp =
  'Audience templates define the base audience. The rules shown below narrow it further, and built-in eligibility filters also apply. Preview the audience before activation.'
const firstPurchaseHelp =
  'Targets registered users who have never paid, for campaigns that encourage a first purchase.'
const groupHelp =
  'Choose Allow or Block, then select the user groups to include or exclude. With no group filter, eligible users from every group are included.'
const testI18n = createInstance()
const operationOrder: string[] = []
const createMutation = mock(async (draft: RecallCampaignDraft) => {
  operationOrder.push('save')
  return {
    success: true,
    data: { id: 123, name: draft.name, config_revision: 7 },
  }
})
const updateMutation = mock(
  async (value: { id: number; draft: RecallCampaignDraft }) => {
    operationOrder.push('update')
    return {
      success: true,
      data: {
        id: value.id,
        name: value.draft.name,
        config_revision: 9,
      },
    }
  }
)
const generateMutation = mock(
  async (value: {
    id: number
    request: {
      config_revision: number
      name: string
      email_sequence: RecallCampaignDraft['email_sequence']
    }
  }) => {
    operationOrder.push('generate')
    const task = {
      id: 55,
      campaign_id: value.id,
      requested_config_revision: value.request.config_revision,
      status: 'queued',
      attempt_count: 0,
      created_at: 1_900_000_000,
    } satisfies RecallTranslationTask
    return {
      success: true,
      data: task,
    }
  }
)
let latestSpecifiedUsersProps:
  | {
      userIDs: number[]
      emails: string[]
      onUserIDsChange: (value: number[]) => void
      onEmailsChange: (value: string[]) => void
      immutable: boolean
    }
  | undefined
let latestAudienceTemplateChange: ((value: string) => void) | undefined
let latestCampaignTypeChange: ((value: string) => void) | undefined
const latestInputProps: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement>
> = {}
const latestSwitchProps: Record<
  string,
  {
    checked?: boolean
    disabled?: boolean
    onCheckedChange?: (checked: boolean) => void
  }
> = {}

spyOn(recallApi, 'useRecallCampaignMutations').mockImplementation(() => ({
  create: { isPending: false, mutateAsync: createMutation },
  update: { isPending: false, mutateAsync: updateMutation },
  action: {
    isPending: false,
    mutateAsync: mock(async () => ({ success: true })),
  },
  retry: {
    isPending: false,
    mutateAsync: mock(async () => ({ success: true })),
  },
  generate: { isPending: false, mutateAsync: generateMutation },
}))

mock.module('@/components/ui/select', () => ({
  Select: (props: {
    children: React.ReactNode
    disabled?: boolean
    items?: { label: string; value: string }[]
    onValueChange?: (value: string) => void
    value?: string
  }) => {
    const name = props.items?.some((item) => item.value === 'first_purchase')
      ? 'audience_template'
      : props.items?.some((item) => item.value === 'content_only')
        ? 'campaign_type'
        : undefined
    if (name === 'audience_template') {
      latestAudienceTemplateChange = props.onValueChange
    }
    if (name === 'campaign_type') {
      latestCampaignTypeChange = props.onValueChange
    }
    return (
      <>
        <select
          disabled={props.disabled}
          name={name}
          onChange={(event) => props.onValueChange?.(event.target.value)}
          value={props.value}
        >
          {props.items?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <div>{props.children}</div>
      </>
    )
  },
  SelectContent: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectGroup: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectItem: (props: { children: React.ReactNode; value: string }) => (
    <div data-value={props.value}>{props.children}</div>
  ),
  SelectTrigger: (props: {
    'aria-describedby'?: string
    children: React.ReactNode
    className?: string
  }) => (
    <button
      aria-describedby={props['aria-describedby']}
      className={props.className}
      type='button'
    >
      {props.children}
    </button>
  ),
  SelectValue: () => <span />,
}))

mock.module('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    if (props.id) latestInputProps[props.id] = props
    return <input {...props} />
  },
}))

mock.module('@/components/ui/switch', () => ({
  Switch: (props: {
    checked?: boolean
    disabled?: boolean
    id?: string
    onCheckedChange?: (checked: boolean) => void
  }) => {
    if (props.id) latestSwitchProps[props.id] = props
    return (
      <input
        checked={props.checked}
        disabled={props.disabled}
        id={props.id}
        onChange={(event) =>
          props.onCheckedChange?.(event.currentTarget.checked)
        }
        role='switch'
        type='checkbox'
      />
    )
  },
}))

mock.module('@/components/multi-select', () => ({
  MultiSelect: (props: {
    disabled?: boolean
    id?: string
    onChange?: (value: string[]) => void
    options?: { label: string; value: string }[]
    placeholder?: string
    selected?: string[]
  }) => (
    <div>
      <input
        aria-label={props.placeholder}
        disabled={props.disabled}
        id={props.id}
        readOnly
        value={props.disabled ? '' : (props.selected ?? []).join(',')}
      />
      {props.options?.map((option) => (
        <span key={option.value}>{option.label}</span>
      ))}
    </div>
  ),
}))

const { CampaignOfferValidityFields } =
  await import('./campaign-offer-validity-fields')
const { CampaignEditor, createRecallCampaignFormDraft } =
  await import('./campaign-editor')

function MockSpecifiedUsersSelector(
  props: NonNullable<typeof latestSpecifiedUsersProps>
) {
  // eslint-disable-next-line react-hooks/globals
  latestSpecifiedUsersProps = props
  return (
    <div data-testid='specified-users-selector'>
      <input
        id='recall-specified-users'
        disabled={props.immutable}
        readOnly
        value={props.userIDs.join(',')}
      />
      <textarea
        id='recall-specified-emails'
        disabled={props.immutable}
        readOnly
        value={props.emails.join('\n')}
      />
    </div>
  )
}

function makeDraft(template: RecallAudienceTemplate): RecallCampaignDraft {
  return {
    campaign_type: 'promotion',
    name: 'Test campaign',
    audience_template: template,
    audience_config: {
      registration_age_days: 30,
      min_request_count: 1,
      max_quota: 0,
      min_paid_amount: 0,
      last_api_call_age_days: 30,
      last_payment_age_days: 30,
      subscription_expired_days: 30,
      min_subscription_amount: 0,
      min_subscription_count: 1,
      payment_providers: [],
      groups: [],
      group_mode: '',
      require_verified_email: true,
      registration_start_at: 0,
      registration_end_at: 0,
      specified_user_ids: [],
      specified_emails: [],
    },
    execution_mode: 'manual',
    schedule: {
      scheduled_at: 0,
      timezone: 'UTC',
      frequency: 'daily',
      weekday: 1,
      hour: 9,
      minute: 0,
    },
    coupon_source: 'automatic',
    existing_coupon_id: '',
    discount_config: {
      type: 'percent',
      percent_off: 20,
      amount_off: 0,
      currency: '',
      currency_options: {},
      minimum_amount: 0,
      minimum_amount_currency: '',
    },
    product_scope: {
      topup_price_ids: ['price_topup_usd'],
      subscription_price_ids: [],
    },
    promotion_expiry_mode: 'relative',
    promotion_expires_at: 0,
    promotion_valid_seconds: 604800,
    enrollment_limit: 1000,
    worker_concurrency: 5,
    email_sequence: [
      {
        stage_no: 1,
        delay_seconds: 0,
        template_version: 1,
        templates: {
          en: { subject: 'English subject', body_text: 'English body' },
          fr: { subject: 'Sujet français', body_text: 'Corps français' },
        },
      },
    ],
    defer_localization: true,
  }
}

const originalGlobalPropertyDescriptors = new Map<
  PropertyKey,
  PropertyDescriptor | undefined
>()

function defineTestGlobal(key: PropertyKey, value: unknown) {
  if (!originalGlobalPropertyDescriptors.has(key)) {
    originalGlobalPropertyDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key)
    )
  }
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
    writable: true,
  })
}

function restoreTestGlobals() {
  for (const [key, descriptor] of originalGlobalPropertyDescriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
}

function setupDom() {
  if (typeof document !== 'undefined') {
    defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    return
  }

  class NodeShim {
    childNodes: NodeShim[] = []
    nodeType = 0
    nodeName = ''
    parentNode: NodeShim | null = null
    ownerDocument = globalThis.document
    private listeners: Record<string, EventListener[]> = {}

    appendChild(node: NodeShim) {
      this.childNodes.push(node)
      ;(this as unknown as Record<number, NodeShim>)[
        this.childNodes.length - 1
      ] = node
      node.parentNode = this
      return node
    }

    insertBefore(node: NodeShim, before: NodeShim | null) {
      const index = before ? this.childNodes.indexOf(before) : -1
      if (index < 0) return this.appendChild(node)
      this.childNodes.splice(index, 0, node)
      node.parentNode = this
      return node
    }

    removeChild(node: NodeShim) {
      this.childNodes = this.childNodes.filter((child) => child !== node)
      node.parentNode = null
      return node
    }

    addEventListener(type: string, listener: EventListener) {
      this.listeners[type] ??= []
      this.listeners[type].push(listener)
    }

    removeEventListener(type: string, listener: EventListener) {
      this.listeners[type] = (this.listeners[type] ?? []).filter(
        (current) => current !== listener
      )
    }

    dispatchEvent(event: Event) {
      if (!('target' in event) || event.target === null) {
        Object.defineProperty(event, 'target', { value: this })
      }
      Object.defineProperty(event, 'currentTarget', {
        configurable: true,
        value: this,
      })
      for (const listener of this.listeners[event.type] ?? []) {
        listener.call(this, event)
      }
      if (event.bubbles && this.parentNode) {
        this.parentNode.dispatchEvent(event)
      }
      return !event.defaultPrevented
    }
  }

  class ElementShim extends NodeShim {
    attributes: Record<string, string> = {}
    disabled = false
    localName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    style = {}
    tagName: string
    value = ''
    defaultSelected = false
    selected = false
    private text = ''

    constructor(tagName: string) {
      super()
      this.nodeType = 1
      this.localName = tagName
      this.tagName = tagName.toUpperCase()
      this.nodeName = this.tagName
    }

    set textContent(value: string) {
      this.text = String(value)
      this.childNodes = []
    }

    get textContent() {
      return (
        this.text ||
        this.childNodes
          .map((node) => ('textContent' in node ? node.textContent : ''))
          .join('')
      )
    }

    get length() {
      return this.childNodes.length
    }

    get options() {
      return this
    }

    setAttribute(key: string, value: string) {
      this.attributes[key] = String(value)
      if (key === 'disabled') this.disabled = true
      if (key === 'value') this.value = String(value)
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
    }

    querySelector(selector: string): ElementShim | null {
      if (selector.startsWith('#')) {
        const id = selector.slice(1)
        if (this.attributes.id === id) return this
      }
      for (const child of this.childNodes) {
        if (child instanceof ElementShim) {
          const match = child.querySelector(selector)
          if (match) return match
        }
      }
      return null
    }

    focus() {
      ;(
        globalThis.document as unknown as { activeElement: ElementShim }
      ).activeElement = this
    }
  }

  class TextShim extends NodeShim {
    textContent: string

    constructor(text: string) {
      super()
      this.nodeType = 3
      this.nodeName = '#text'
      this.textContent = text
    }
  }

  const head = new ElementShim('head')
  const shimDocument = {
    nodeType: 9,
    head,
    createElement: (tagName: string) => new ElementShim(tagName),
    createElementNS: (_namespace: string, tagName: string) =>
      new ElementShim(tagName),
    createTextNode: (text: string) => new TextShim(text),
    getElementsByTagName: (tagName: string) =>
      tagName.toLowerCase() === 'head' ? [head] : [],
    addEventListener() {},
    removeEventListener() {},
    defaultView: globalThis,
    activeElement: null,
  }
  defineTestGlobal('document', shimDocument as unknown as Document)
  defineTestGlobal(
    'window',
    globalThis as unknown as Window & typeof globalThis
  )
  defineTestGlobal('location', { href: 'http://localhost/' } as Location)
  const localStorage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  } as unknown as Storage
  defineTestGlobal('localStorage', localStorage)
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
      },
    },
  })
  queryClient.setQueryData(recallApi.recallCampaignKeys.userGroups, {
    success: true,
    data: ['admin', 'default', 'plg'],
  })
  queryClient.setQueryData(
    recallApi.recallCampaignKeys.topUpProductConfiguration,
    {
      success: true,
      data: { stripe_price_ids: { USD: 'price_topup_usd' } },
    }
  )
  queryClient.setQueryData(
    recallApi.recallCampaignKeys.subscriptionProductConfiguration,
    {
      success: true,
      data: [],
    }
  )
  return queryClient
}

function renderEditor(
  template: RecallAudienceTemplate,
  draft = makeDraft(template),
  options: { injectSpecifiedUsersSelector?: boolean } = {}
): string {
  const queryClient = createQueryClient()
  const editorProps =
    options.injectSpecifiedUsersSelector === false
      ? {}
      : {
          specifiedUsersSelector: MockSpecifiedUsersSelector,
        }

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <CampaignEditor initialDraft={draft} {...editorProps} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function renderEditorDom(
  draft: RecallCampaignDraft,
  props: Partial<React.ComponentProps<typeof CampaignEditor>> = {}
): { root: Root; container: HTMLElement } {
  const queryClient = createQueryClient()
  const container = document.createElement('div')
  const root = createRoot(container)

  React.act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignEditor
            initialDraft={draft}
            specifiedUsersSelector={MockSpecifiedUsersSelector}
            {...props}
          />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })

  return { root, container }
}

function createOfferValidityForm(
  draft: RecallCampaignDraft
): UseFormReturn<RecallCampaignDraft> {
  const form = createFormControl<RecallCampaignDraft>({
    defaultValues: createRecallCampaignFormDraft(draft),
  })
  form.subscribe({
    formState: { errors: true, values: true },
    callback: () => undefined,
  })
  for (const field of [
    'discount_config.minimum_amount',
    'discount_config.minimum_amount_currency',
    'discount_config.minimum_spend.enabled',
    'discount_config.minimum_spend.amounts.usd',
    'discount_config.minimum_spend.amounts.inr',
    'discount_config.minimum_spend.amounts.brl',
    'discount_config.minimum_spend.amounts.jpy',
    'promotion_expiry_mode',
    'promotion_expires_at',
    'promotion_valid_seconds',
  ] as const) {
    form.register(field)
  }
  return form as unknown as UseFormReturn<RecallCampaignDraft>
}

function renderOfferValidityFieldsDom(draft: RecallCampaignDraft): {
  form: UseFormReturn<RecallCampaignDraft>
  root: Root
} {
  const form = createOfferValidityForm(draft)
  const container = document.createElement('div')
  const root = createRoot(container)

  React.act(() => {
    root.render(
      <I18nextProvider i18n={testI18n}>
        <CampaignOfferValidityFields
          form={form}
          immutable={false}
          nowSeconds={2_000_000_000}
        />
      </I18nextProvider>
    )
  })

  return { form, root }
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

async function submit(container: HTMLElement) {
  const form = container.childNodes[0] as HTMLFormElement
  await React.act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

async function clickByID(container: HTMLElement, id: string) {
  const element = container.querySelector(`#${id}`)
  expect(element).toBeTruthy()
  await React.act(async () => {
    element?.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true })
    )
    await Promise.resolve()
  })
}

async function changeInputProp(id: string, value: string) {
  await React.act(async () => {
    latestInputProps[id]?.onChange?.({
      target: { name: latestInputProps[id]?.name, value },
      type: 'change',
    } as React.ChangeEvent<HTMLInputElement>)
    await Promise.resolve()
  })
}

async function setSwitchProp(id: string, checked: boolean) {
  await React.act(async () => {
    latestSwitchProps[id]?.onCheckedChange?.(checked)
    await Promise.resolve()
  })
}

const audienceThresholdFields = [
  'registration_age_days',
  'min_request_count',
  'max_quota',
  'min_paid_amount',
  'last_api_call_age_days',
  'last_payment_age_days',
  'subscription_expired_days',
  'min_subscription_amount',
  'min_subscription_count',
] as const

function expectAudienceThresholds(
  html: string,
  shownFields: (typeof audienceThresholdFields)[number][]
) {
  for (const field of audienceThresholdFields) {
    const inputName = `name="audience_config.${field}"`
    if (shownFields.includes(field)) {
      expect(html).toContain(inputName)
    } else {
      expect(html).not.toContain(inputName)
    }
  }
}

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          [commonHelp]: commonHelp,
          [firstPurchaseHelp]: firstPurchaseHelp,
          [groupHelp]: groupHelp,
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  latestSpecifiedUsersProps = undefined
  latestAudienceTemplateChange = undefined
  latestCampaignTypeChange = undefined
  for (const key of Object.keys(latestInputProps)) {
    delete latestInputProps[key]
  }
  for (const key of Object.keys(latestSwitchProps)) {
    delete latestSwitchProps[key]
  }
  createMutation.mockClear()
  updateMutation.mockClear()
  generateMutation.mockClear()
  generateMutation.mockImplementation(async (value) => {
    operationOrder.push('generate')
    const task = {
      id: 55,
      campaign_id: value.id,
      requested_config_revision: value.request.config_revision,
      status: 'queued',
      attempt_count: 0,
      created_at: 1_900_000_000,
    } satisfies RecallTranslationTask
    return {
      success: true,
      data: task,
    }
  })
  operationOrder.length = 0
})

afterAll(() => {
  mock.restore()
  restoreTestGlobals()
})

describe('CampaignEditor audience rules', () => {
  test('offers promotion and content-only campaign types', () => {
    const html = renderEditor('first_purchase')

    expect(html).toContain('Campaign type')
    expect(html).toContain('value="promotion"')
    expect(html).toContain('Promotion')
    expect(html).toContain('value="content_only"')
    expect(html).toContain('Content only')
  })

  test('hides promotion-only controls for content-only campaigns', () => {
    const draft = makeDraft('first_purchase')
    draft.campaign_type = 'content_only'
    draft.product_scope = { topup_price_ids: [], subscription_price_ids: [] }

    const html = renderEditor('first_purchase', draft)

    expect(html).toContain('Campaign type')
    expect(html).toContain('1. Campaign and audience')
    expect(html).toContain('2. Audience rules')
    expect(html).toContain('5. Execution schedule')
    expect(html).toContain('6. Email sequence')
    expect(html).not.toContain('3. Stripe Coupon')
    expect(html).toContain('4. Activity delivery')
    expect(html).not.toContain('Coupon source')
    expect(html).not.toContain('Discount type')
    expect(html).not.toContain('Top-up products')
    expect(html).not.toContain('Subscription products')
    expect(html).not.toContain('Minimum amount')
    expect(html).not.toContain('Promotion validity seconds')
    expect(html).toContain('Activity delivery validity seconds')
    expect(html).toContain('Enrollment limit')
    expect(html).toContain('Worker concurrency')
  })

  test('preserves hidden promotion state when switching to content-only and submitting', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].templates = Object.fromEntries(
      ['en', 'zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'].map((locale) => [
        locale,
        {
          subject: '',
          body_text: '',
          body_html: RECALL_EMAIL_STARTER_HTML,
        },
      ])
    )
    draft.coupon_source = 'existing'
    draft.existing_coupon_id = 'coupon_preserve'
    draft.discount_config = {
      type: 'fixed',
      percent_off: 0,
      amount_off: 1200,
      currency: 'USD',
      currency_options: {},
      minimum_amount: 2500,
      minimum_amount_currency: 'USD',
    }
    draft.product_scope = {
      topup_price_ids: ['price_topup_usd'],
      subscription_price_ids: ['price_sub_monthly'],
    }
    const { root, container } = renderEditorDom(draft)

    React.act(() => {
      latestCampaignTypeChange?.('content_only')
    })
    await submit(container)

    expect(createMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.campaign_type).toBe('content_only')
    expect(submitted.coupon_source).toBe('existing')
    expect(submitted.existing_coupon_id).toBe('coupon_preserve')
    expect(submitted.discount_config).toEqual(
      createRecallCampaignFormDraft(draft).discount_config
    )
    expect(submitted.product_scope).toEqual(draft.product_scope)
    for (const template of Object.values(
      submitted.email_sequence[0].templates
    )) {
      expect(template.body_html).toBe(RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML)
    }
    dispose(root)
  })

  test('offers all six audience template values with source descriptions', () => {
    const html = renderEditor('first_purchase')

    for (const [value, label] of [
      ['first_purchase', 'First purchase'],
      ['lapsed_payer', 'Lapsed payer'],
      ['expired_subscription', 'Expired subscription'],
      ['registered_only', 'Registered only'],
      ['registration_time_range', 'Registration time range'],
      ['specified_users', 'Specified users'],
    ] as const) {
      expect(html).toContain(`value="${value}"`)
      expect(html).toContain(label)
    }

    expect(renderEditor('registered_only')).toContain(
      'Targets users who registered within a selected registration date range.'
    )
    expect(renderEditor('specified_users')).toContain(
      'Targets explicitly selected users by user ID or email address.'
    )
  })

  test('integrates the configured group selector with a stable id when group filtering is active', () => {
    const draft = makeDraft('first_purchase')
    draft.audience_config.group_mode = 'allow'
    const html = renderEditor('first_purchase', draft)

    expect(html).toContain('for="recall-groups"')
    expect(html).toContain('Recall user groups')
    expect(html).toContain('aria-label="Select user groups"')
    expect(html).not.toContain('Loading configured user groups...')
    const groupInput = html.match(/<input[^>]*id="recall-groups"[^>]*>/)?.[0]
    expect(groupInput).toBeTruthy()
    expect(groupInput).not.toContain('disabled=""')
  })

  test('hides only the group selector when group filtering is disabled', () => {
    const draft = makeDraft('first_purchase')
    draft.audience_config.groups = ['stale-group']
    const html = renderEditor('first_purchase', draft)

    expect(html).not.toContain('for="recall-groups"')
    expect(html).not.toContain('Recall user groups')
    expect(html).not.toContain('aria-label="Select user groups"')
    expect(html).toContain('Group mode')
    expect(html).toContain('No group filter')
    expect(html).toContain(groupHelp)
    expect(html).not.toContain('stale-group')
  })

  test('keeps active group selectors and every group-mode choice visible', () => {
    for (const mode of ['allow', 'block'] as const) {
      const draft = makeDraft('first_purchase')
      draft.audience_config.group_mode = mode
      const html = renderEditor('first_purchase', draft)

      expect(html).toContain('for="recall-groups"')
      expect(html).toContain('No group filter')
      expect(html).toContain('Allow groups')
      expect(html).toContain('Block groups')
    }
  })

  test('uses approved group guidance without free-form or PLG wording when group filtering is active', () => {
    const draft = makeDraft('first_purchase')
    draft.audience_config.group_mode = 'allow'
    const html = renderEditor('first_purchase', draft)

    expect(html).toContain(groupHelp)
    expect(html).not.toContain('Groups (comma separated)')
    expect(html).not.toContain('PLG group')
  })

  test('uses configured product selectors instead of manual Stripe Price ID inputs', () => {
    const html = renderEditor('first_purchase')

    expect(html).toContain('Top-up products')
    expect(html).toContain('Subscription products')
    expect(html).not.toContain('Top-up Stripe Price IDs')
    expect(html).not.toContain('Subscription Stripe Price IDs')
  })

  test('explains the selected audience and associates the help with the selector', () => {
    const html = renderEditor('first_purchase')

    expect(html).toContain(commonHelp)
    expect(html).toContain(firstPurchaseHelp)
    expect(html).toContain('aria-describedby="recall-audience-help"')
    expect(html).toContain('id="recall-audience-help"')
    expect(html).toContain('aria-live="polite"')
  })

  test('shows every rule applied to first-purchase audiences', () => {
    const html = renderEditor('first_purchase')

    expectAudienceThresholds(html, [
      'registration_age_days',
      'min_request_count',
      'max_quota',
      'last_api_call_age_days',
    ])
    expect(html).not.toContain('Payment providers (comma separated)')
  })

  test('shows every rule applied to lapsed-payer audiences', () => {
    const html = renderEditor('lapsed_payer')

    expectAudienceThresholds(html, [
      'max_quota',
      'min_paid_amount',
      'last_api_call_age_days',
      'last_payment_age_days',
    ])
    expect(html).toContain('Payment providers (comma separated)')
  })

  test('shows every rule applied to expired-subscription audiences', () => {
    const html = renderEditor('expired_subscription')

    expectAudienceThresholds(html, [
      'last_api_call_age_days',
      'subscription_expired_days',
      'min_subscription_amount',
      'min_subscription_count',
    ])
    expect(html).toContain('Payment providers (comma separated)')
  })

  test('shows registration dates, group mode, and verified email for registered-only audiences without group filtering', () => {
    const draft = makeDraft('registered_only')
    draft.audience_config.registration_start_at =
      recallLocalDateTimeToUnix('2031-01-02T03:04')
    draft.audience_config.registration_end_at =
      recallLocalDateTimeToUnix('2031-01-03T03:04')
    const html = renderEditor('registered_only', draft)

    expect(html).toContain('for="recall-registration-start-at"')
    expect(html).toContain('for="recall-registration-end-at"')
    expect(html).toContain('aria-labelledby="recall-registration-range-label"')
    expect(html).toContain('Registration time range')
    expect(html).toContain('type="datetime-local"')
    expect(html).toContain('value="2031-01-02T03:04"')
    expect(html).toContain('value="2031-01-03T03:04"')
    expect(html).not.toContain('for="recall-groups"')
    expect(html).toContain('Group mode')
    expect(html).toContain('No group filter')
    expect(html).toContain(groupHelp)
    expect(html).toContain('Require verified email')
    expectAudienceThresholds(html, [])
    expect(html).not.toContain('Payment providers (comma separated)')
  })

  test('registration-time-range shows registration controls and reusable group filtering', () => {
    const template = 'registration_time_range' as RecallAudienceTemplate
    let html = ''

    expect(() => {
      html = renderEditor(template)
    }).not.toThrow()
    expect(html).toContain('Registration time range')
    expect(html).toContain('aria-labelledby="recall-registration-range-label"')
    expect(html).toContain('name="audience_config.registration_start_at"')
    expect(html).toContain('name="audience_config.registration_end_at"')
    expect(html).toContain('Group mode')
    expect(html).toContain('No group filter')
    expect(html).toContain(groupHelp)
    expect(html).not.toContain('for="recall-groups"')
    expect(html).toContain('Require verified email')

    const groupedDraft = makeDraft(template)
    groupedDraft.audience_config.group_mode = 'allow'
    groupedDraft.audience_config.groups = ['plg']
    html = renderEditor(template, groupedDraft)
    expect(html).toContain('for="recall-groups"')
    expect(html).toContain('Recall user groups')
    expect(html).toContain('value="plg"')
    expect(html).toContain('>plg<')
    expect(html).not.toContain('Payment providers (comma separated)')
    expectAudienceThresholds(html, [])
  })

  test('disables native validation so registered-only empty dates reach schema errors', () => {
    const html = renderEditor('registered_only')

    expect(html).toContain('<form')
    expect(html).toContain('noValidate=""')
    expect(html).toContain('required=""')
    expect(html).toContain('name="audience_config.registration_start_at"')
    expect(html).toContain('name="audience_config.registration_end_at"')
  })

  test('keeps both registration datetimes after blur and submits Unix seconds', async () => {
    const draft = makeDraft('registered_only')
    const { root, container } = renderEditorDom(draft)

    React.act(() => {
      latestInputProps['recall-registration-start-at'].onChange?.({
        target: {
          name: 'audience_config.registration_start_at',
          value: '2031-01-02T03:04',
        },
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>)
    })
    React.act(() => {
      latestInputProps['recall-registration-start-at'].onBlur?.({
        target: {
          name: 'audience_config.registration_start_at',
          value: '2031-01-02T03:04',
        },
        type: 'blur',
      } as React.FocusEvent<HTMLInputElement>)
    })
    expect(latestInputProps['recall-registration-start-at'].value).toBe(
      '2031-01-02T03:04'
    )

    React.act(() => {
      latestInputProps['recall-registration-end-at'].onChange?.({
        target: {
          name: 'audience_config.registration_end_at',
          value: '2031-01-03T03:04',
        },
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>)
    })
    React.act(() => {
      latestInputProps['recall-registration-end-at'].onBlur?.({
        target: {
          name: 'audience_config.registration_end_at',
          value: '2031-01-03T03:04',
        },
        type: 'blur',
      } as React.FocusEvent<HTMLInputElement>)
    })
    expect(latestInputProps['recall-registration-end-at'].value).toBe(
      '2031-01-03T03:04'
    )
    await submit(container)

    expect(createMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.audience_config.registration_start_at).toBe(
      recallLocalDateTimeToUnix('2031-01-02T03:04')
    )
    expect(submitted.audience_config.registration_end_at).toBe(
      recallLocalDateTimeToUnix('2031-01-03T03:04')
    )
    dispose(root)
  })

  test('renders specified-users selector with current values and hides unrelated audience controls', () => {
    const draft = makeDraft('specified_users')
    draft.audience_config.specified_user_ids = [12, 34]
    draft.audience_config.specified_emails = ['one@example.com']

    const html = renderEditor('specified_users', draft)

    expect(latestSpecifiedUsersProps?.userIDs).toEqual([12, 34])
    expect(latestSpecifiedUsersProps?.emails).toEqual(['one@example.com'])
    expect(latestSpecifiedUsersProps?.immutable).toBe(false)
    expect(html).toContain('Require verified email')
    expect(html).toContain('id="recall-specified-users"')
    expect(html).toContain('id="recall-specified-emails"')
    expectAudienceThresholds(html, [])
    expect(html).not.toContain('Payment providers (comma separated)')
    expect(html).not.toContain('Group mode')
    expect(html).not.toContain('type="datetime-local"')
  })

  test('uses a translated live status while specified-users selector is loading', () => {
    const html = renderEditor('specified_users', makeDraft('specified_users'), {
      injectSpecifiedUsersSelector: false,
    })

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Loading...')
  })

  test('specified-users callbacks update form values and survive template switches', async () => {
    const draft = makeDraft('specified_users')
    const { root, container } = renderEditorDom(draft)

    React.act(() => {
      latestSpecifiedUsersProps?.onUserIDsChange([9, 10])
      latestSpecifiedUsersProps?.onEmailsChange(['two@example.com'])
    })
    expect(latestSpecifiedUsersProps?.userIDs).toEqual([9, 10])
    expect(latestSpecifiedUsersProps?.emails).toEqual(['two@example.com'])

    React.act(() => {
      latestAudienceTemplateChange?.('first_purchase')
    })
    React.act(() => {
      latestAudienceTemplateChange?.('specified_users')
    })

    expect(latestSpecifiedUsersProps?.userIDs).toEqual([9, 10])
    expect(latestSpecifiedUsersProps?.emails).toEqual(['two@example.com'])
    await submit(container)
    expect(createMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.audience_config.specified_user_ids).toEqual([9, 10])
    expect(submitted.audience_config.specified_emails).toEqual([
      'two@example.com',
    ])
    dispose(root)
  })

  test('loads registered-only and specified-users drafts with preserved defaults', () => {
    const registeredDraft = makeDraft('registered_only')
    const specifiedDraft = makeDraft('specified_users')

    expect(registeredDraft.audience_config.registration_start_at).toBe(0)
    expect(registeredDraft.audience_config.registration_end_at).toBe(0)
    expect(specifiedDraft.audience_config.specified_user_ids).toEqual([])
    expect(specifiedDraft.audience_config.specified_emails).toEqual([])
    expect(renderEditor('registered_only', registeredDraft)).toContain(
      'name="audience_config.registration_start_at"'
    )
    renderEditor('specified_users', specifiedDraft)
    expect(latestSpecifiedUsersProps?.userIDs).toEqual([])
    expect(latestSpecifiedUsersProps?.emails).toEqual([])
  })

  test('blocks schema submission for invalid registered-only and specified-users audience controls', async () => {
    for (const draft of [
      makeDraft('registered_only'),
      (() => {
        const value = makeDraft('registered_only')
        value.audience_config.registration_start_at =
          recallLocalDateTimeToUnix('2031-01-03T03:04')
        value.audience_config.registration_end_at =
          recallLocalDateTimeToUnix('2031-01-02T03:04')
        return value
      })(),
      makeDraft('specified_users'),
      (() => {
        const value = makeDraft('specified_users')
        value.audience_config.specified_emails = ['invalid-email']
        return value
      })(),
      (() => {
        const value = makeDraft('specified_users')
        value.audience_config.specified_user_ids = Array.from(
          { length: 501 },
          (_, index) => index + 1
        )
        return value
      })(),
    ]) {
      createMutation.mockClear()
      const { root, container } = renderEditorDom(draft)
      await submit(container)
      expect(createMutation).not.toHaveBeenCalled()
      expect(container.textContent).toContain(
        'Please correct the highlighted fields.'
      )
      dispose(root)
    }
  })
})

describe('CampaignEditor offer validity', () => {
  test('replaces raw validity and minimum-currency inputs with guided controls', () => {
    const html = renderEditor('first_purchase')

    expect(html).toContain('Promotion expiry mode')
    expect(html).toContain('Relative duration')
    expect(html).toContain('Set minimum spend')
    expect(html).not.toContain('Coupon redeem-by')
    expect(html).not.toContain('recall-coupon-redeem-by')
    expect(html).not.toContain('Promotion validity seconds')
    expect(html).not.toContain('Minimum amount currency')
  })

  test('shows minimum spend toggle for automatic fixed coupons', () => {
    const draft = makeDraft('first_purchase')
    draft.discount_config.type = 'fixed'
    draft.discount_config.percent_off = 0
    draft.discount_config.amount_off = 500
    draft.discount_config.currency = 'USD'
    draft.discount_config.currency_options = {
      inr: 45_000,
      brl: 2_500,
      jpy: 750,
    }

    const html = renderEditor('first_purchase', draft)

    expect(html).toContain('Set minimum spend')
    expect(html).toContain('id="recall-minimum-spend-enabled"')
  })

  test('minimum spend switch and inputs submit canonical values and clear when disabled', async () => {
    const draft = makeDraft('first_purchase')
    const { root, container } = renderEditorDom(draft)

    expect(latestInputProps['recall-minimum-spend-usd']).toBeUndefined()

    await setSwitchProp('recall-minimum-spend-enabled', true)
    for (const currency of ['usd', 'inr', 'brl', 'jpy']) {
      expect(latestInputProps[`recall-minimum-spend-${currency}`]).toBeTruthy()
    }

    await changeInputProp('recall-minimum-spend-usd', '12.34')
    await changeInputProp('recall-minimum-spend-inr', '900.50')
    await changeInputProp('recall-minimum-spend-brl', '25.99')
    await changeInputProp('recall-minimum-spend-jpy', '750')
    await submit(container)

    expect(createMutation).toHaveBeenCalledTimes(1)
    let submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.discount_config.minimum_spend).toEqual({
      enabled: true,
      amounts: { usd: 1234, inr: 90050, brl: 2599, jpy: 750 },
    })
    expect(submitted.discount_config.minimum_amount).toBe(1234)
    expect(submitted.discount_config.minimum_amount_currency).toBe('USD')

    createMutation.mockClear()
    updateMutation.mockClear()
    await setSwitchProp('recall-minimum-spend-enabled', false)
    expect(container.querySelector('#recall-minimum-spend-usd')).toBeNull()
    await submit(container)

    expect(createMutation).not.toHaveBeenCalled()
    expect(updateMutation).toHaveBeenCalledTimes(1)
    submitted = updateMutation.mock.calls[0][0].draft as RecallCampaignDraft
    expect(submitted.discount_config.minimum_spend).toEqual({
      enabled: false,
      amounts: {},
    })
    expect(submitted.discount_config.minimum_amount).toBe(0)
    expect(submitted.discount_config.minimum_amount_currency).toBe('')

    await setSwitchProp('recall-minimum-spend-enabled', true)
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('')
    dispose(root)
  })

  test('minimum spend inputs preserve raw typing while canonical values validate', async () => {
    const draft = makeDraft('first_purchase')
    draft.discount_config.minimum_spend = {
      enabled: true,
      amounts: { usd: 1200, inr: 90050, brl: 2599, jpy: 750 },
    }
    draft.discount_config.minimum_amount = 1200
    draft.discount_config.minimum_amount_currency = 'USD'
    const { root, container } = renderEditorDom(draft)

    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.00')
    expect(latestInputProps['recall-minimum-spend-jpy']?.value).toBe('750')

    for (const value of ['1', '12', '12.', '12.3', '12.34']) {
      await changeInputProp('recall-minimum-spend-usd', value)
      expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe(value)
    }

    await changeInputProp('recall-minimum-spend-jpy', '7')
    expect(latestInputProps['recall-minimum-spend-jpy']?.value).toBe('7')

    await changeInputProp('recall-minimum-spend-usd', '12.345')
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.345')
    await submit(container)
    expect(createMutation).not.toHaveBeenCalled()
    expect(container.textContent).toContain(
      'Please correct the highlighted fields.'
    )

    await changeInputProp('recall-minimum-spend-usd', '12.34')
    await submit(container)
    expect(createMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.discount_config.minimum_spend).toEqual({
      enabled: true,
      amounts: { usd: 1234, inr: 90050, brl: 2599, jpy: 7 },
    })
    expect(submitted.discount_config.minimum_amount).toBe(1234)
    expect(submitted.discount_config.minimum_amount_currency).toBe('USD')
    dispose(root)
  })

  test('minimum spend raw values sync after same-value input and external amount changes', async () => {
    const draft = makeDraft('first_purchase')
    draft.discount_config.minimum_spend = {
      enabled: true,
      amounts: { usd: 1200, inr: 90050, brl: 2599, jpy: 750 },
    }
    draft.discount_config.minimum_amount = 1200
    draft.discount_config.minimum_amount_currency = 'USD'
    const { form, root } = renderOfferValidityFieldsDom(draft)

    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.00')
    await changeInputProp('recall-minimum-spend-usd', '12.00')
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.00')

    await React.act(async () => {
      form.setValue('discount_config.minimum_spend.amounts.usd', 0, {
        shouldDirty: true,
        shouldValidate: true,
      })
      await Promise.resolve()
    })
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('')

    await React.act(async () => {
      form.setValue('discount_config.minimum_spend.amounts.usd', 1200, {
        shouldDirty: true,
        shouldValidate: true,
      })
      await Promise.resolve()
    })
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.00')
    dispose(root)
  })

  test('minimum spend raw values clear when zero-default form reset keeps canonical zero', async () => {
    const draft = makeDraft('first_purchase')
    draft.discount_config.minimum_spend = {
      enabled: true,
      amounts: { usd: 0, inr: 90050, brl: 2599, jpy: 750 },
    }
    draft.discount_config.minimum_amount = 0
    draft.discount_config.minimum_amount_currency = ''
    const { form, root } = renderOfferValidityFieldsDom(draft)

    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('')
    await changeInputProp('recall-minimum-spend-usd', '12.345')
    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('12.345')
    expect(form.getValues('discount_config.minimum_spend.amounts.usd')).toBe(0)

    const resetDraft = form.getValues()
    await React.act(async () => {
      form.reset({
        ...resetDraft,
        discount_config: {
          ...resetDraft.discount_config,
          minimum_amount: 0,
          minimum_amount_currency: '',
          minimum_spend: {
            enabled: true,
            amounts: {
              ...resetDraft.discount_config.minimum_spend.amounts,
              usd: 0,
            },
          },
        },
      })
      await Promise.resolve()
    })

    expect(latestInputProps['recall-minimum-spend-usd']?.value).toBe('')
    dispose(root)
  })
})

describe('CampaignEditor email sequence', () => {
  test('uses the campaign name when an email subject is left empty', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].templates.en.subject = ''
    const { root, container } = renderEditorDom(draft)

    await submit(container)

    expect(createMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(submitted.email_sequence[0].templates.en.subject).toBe(
      'Test campaign'
    )
    expect(container.textContent).toContain(
      'Leave empty to use the campaign name.'
    )
    dispose(root)
  })

  test('renders English-first tabs and the active English fields', () => {
    const draft = makeDraft('first_purchase')
    const html = renderEditor('first_purchase', draft)

    expect(html.match(/role="tab"/g) ?? []).toHaveLength(2)
    expect(html).toContain('English content')
    expect(html).toContain('Translation review')
    expect(html).toContain('name="email_sequence.0.templates.en.subject"')
    expect(html).toContain('name="email_sequence.0.templates.en.body_html"')
    expect(html).not.toContain('name="email_sequence.0.templates.en.body_text"')
    expect(html).not.toContain('templates.fr')
  })

  test('keeps new drafts English-only before explicit generation', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={createQueryClient()}>
        <I18nextProvider i18n={testI18n}>
          <CampaignEditor />
        </I18nextProvider>
      </QueryClientProvider>
    )

    expect(html).toContain('name="email_sequence.0.templates.en.subject"')
    expect(html).not.toContain('templates.es')
    expect(html).toContain('Generate 7 translations')
  })

  test('saves a new draft before one all-stage translation task request', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].templates = {
      en: draft.email_sequence[0].templates.en,
    }
    draft.email_sequence[0].translated_source_revision = 0
    const onSaved = mock(() => undefined)
    const { root, container } = renderEditorDom(draft, { onSaved })

    await clickByID(container, 'recall-generate-translations')

    expect(operationOrder).toEqual(['save', 'generate'])
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledWith(123)
    expect(generateMutation).toHaveBeenCalledTimes(1)
    expect(generateMutation.mock.calls[0][0]).toMatchObject({
      id: 123,
      request: { config_revision: 7, name: 'Test campaign' },
    })
    expect(container.textContent).toContain('0 / 7 ready')
    dispose(root)
  })

  test('generates new draft translations after reviewing missing targets with an empty product scope', async () => {
    const draft = makeDraft('first_purchase')
    draft.product_scope = { topup_price_ids: [], subscription_price_ids: [] }
    draft.email_sequence[0].templates = {
      en: draft.email_sequence[0].templates.en,
    }
    draft.email_sequence[0].translated_source_revision = 0
    const { root, container } = renderEditorDom(draft)

    await clickByID(container, 'recall-email-tab-translations')
    expect(
      (
        container.querySelector(
          '#recall-email-0-zh-subject'
        ) as HTMLInputElement | null
      )?.value
    ).toBe('')

    await clickByID(container, 'recall-generate-translations')

    expect(container.textContent).not.toContain(
      'Please correct the highlighted fields.'
    )
    expect(operationOrder).toEqual(['save', 'generate'])
    expect(createMutation).toHaveBeenCalledTimes(1)
    expect(generateMutation).toHaveBeenCalledTimes(1)
    const submitted = createMutation.mock.calls[0][0] as RecallCampaignDraft
    expect(Object.keys(submitted.email_sequence[0].templates)).toEqual(['en'])
    expect(submitted.product_scope).toEqual({
      topup_price_ids: [],
      subscription_price_ids: [],
    })
    dispose(root)
  })

  test('updates the persisted draft before generating again in the same new editor', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].templates = {
      en: draft.email_sequence[0].templates.en,
    }
    draft.email_sequence[0].translated_source_revision = 0
    const onSaved = mock(() => undefined)
    const { root, container } = renderEditorDom(draft, { onSaved })

    await clickByID(container, 'recall-generate-translations')
    React.act(() => {
      latestInputProps['recall-email-0-en-subject'].onChange?.({
        target: {
          name: 'email_sequence.0.templates.en.subject',
          value: 'Changed English subject',
        },
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>)
    })
    await clickByID(container, 'recall-generate-translations')

    expect(createMutation).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(updateMutation).toHaveBeenCalledTimes(1)
    expect(updateMutation.mock.calls[0][0]).toMatchObject({
      id: 123,
      draft: { name: 'Test campaign' },
    })
    expect(generateMutation).toHaveBeenCalledTimes(2)
    dispose(root)
  })

  test('shows stale targets immediately after English changes', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].source_revision = 1
    draft.email_sequence[0].translated_source_revision = 1
    const { root, container } = renderEditorDom(draft, {
      campaignId: 9,
      configRevision: 4,
    })

    React.act(() => {
      latestInputProps['recall-email-0-en-subject'].onChange?.({
        target: {
          name: 'email_sequence.0.templates.en.subject',
          value: 'Changed English subject',
        },
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>)
    })
    await clickByID(container, 'recall-email-tab-translations')

    expect(container.textContent).toContain('stale')
    dispose(root)
  })

  test('marks manual locale edits and warns before replacing them', async () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].source_revision = 1
    draft.email_sequence[0].translated_source_revision = 1
    draft.email_sequence[0].templates.es = {
      subject: 'Asunto español',
      body_text: 'Cuerpo español',
    }
    draft.email_sequence[0].manual_locales = ['es', 'fr']
    const { root, container } = renderEditorDom(draft, {
      campaignId: 9,
      configRevision: 4,
    })

    await clickByID(container, 'recall-generate-translations')
    expect(generateMutation).not.toHaveBeenCalled()
    expect(container.textContent).toContain(
      'Regenerating will replace 2 manually edited translations.'
    )

    await clickByID(container, 'recall-confirm-regenerate-translations')
    expect(generateMutation).toHaveBeenCalledTimes(1)
    dispose(root)
  })

  test('preserves previous targets when generation fails', async () => {
    generateMutation.mockImplementationOnce(async () => {
      operationOrder.push('generate')
      throw new Error('Translation unavailable')
    })
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].source_revision = 1
    draft.email_sequence[0].translated_source_revision = 1
    draft.email_sequence[0].manual_locales = []
    const { root, container } = renderEditorDom(draft, {
      campaignId: 9,
      configRevision: 4,
    })

    await clickByID(container, 'recall-generate-translations')
    await clickByID(container, 'recall-email-tab-translations')

    const french = container.querySelector(
      '#recall-email-0-fr-subject'
    ) as HTMLInputElement | null
    expect(french?.value).toBe('Sujet français')
    expect(container.textContent).toContain('Translation unavailable')
    dispose(root)
  })

  test('focuses the first structured activation blocker without acknowledgments', () => {
    const draft = makeDraft('first_purchase')
    const { root, container } = renderEditorDom(draft, {
      campaignId: 9,
      configRevision: 4,
      focusBlocker: { stage_no: 1, locale: 'fr', reason: 'missing' },
    })

    expect(container.textContent).toContain('Translation review')
    expect(container.querySelector('#recall-email-0-fr-subject')).toBeTruthy()
    expect(
      (
        document.activeElement as unknown as {
          attributes?: Record<string, string>
        }
      )?.attributes?.id
    ).toBe('recall-email-0-fr-subject')
    expect(container.textContent).not.toContain('Acknowledge locale')
    dispose(root)
  })

  test('loads legacy text as visible editable HTML without UTF-16 native limits', () => {
    const html = renderEditor('first_purchase')
    const subjectInput = html.match(
      /<input[^>]*name="email_sequence\.0\.templates\.en\.subject"[^>]*>/
    )?.[0]
    const bodyInput = html.match(
      /<textarea[^>]*name="email_sequence\.0\.templates\.en\.body_html"[^>]*>/
    )?.[0]

    expect(subjectInput).toBeTruthy()
    expect(subjectInput?.toLowerCase()).not.toContain('maxlength')
    expect(bodyInput).toBeTruthy()
    expect(bodyInput?.toLowerCase()).not.toContain('maxlength')
    expect(html).toContain('&lt;p&gt;English body&lt;/p&gt;')
  })

  test('associates email labels and validation state with stable field IDs', () => {
    const html = renderEditor('first_purchase')
    const subjectInput = html.match(
      /<input[^>]*name="email_sequence\.0\.templates\.en\.subject"[^>]*>/
    )?.[0]
    const bodyInput = html.match(
      /<textarea[^>]*name="email_sequence\.0\.templates\.en\.body_html"[^>]*>/
    )?.[0]

    expect(html).toContain('for="recall-email-0-en-subject"')
    expect(subjectInput).toContain('id="recall-email-0-en-subject"')
    expect(subjectInput).toContain('aria-invalid="false"')
    expect(subjectInput).toContain(
      'aria-describedby="recall-email-0-en-subject-help"'
    )
    expect(html).toContain('for="recall-email-0-en-body-html"')
    expect(bodyInput).toContain('id="recall-email-0-en-body-html"')
    expect(bodyInput).toContain('aria-invalid="false"')
    expect(bodyInput).not.toContain('aria-describedby')
  })

  test('normalizes submitted drafts from the current edited HTML field', () => {
    const draft = makeDraft('first_purchase')
    draft.email_sequence[0].templates.en.body_text = 'stale legacy body'
    draft.email_sequence[0].templates.en.body_html = '<p>Edited HTML</p>'

    const normalized = createRecallCampaignFormDraft(draft)

    expect(normalized.email_sequence[0].templates.en.body_text).toBe('')
    expect(normalized.email_sequence[0].templates.en.body_html).toBe(
      '<p>Edited HTML</p>'
    )
  })

  test('loads empty legacy drafts with starter HTML on the active editor field', () => {
    const draft = createRecallCampaignFormDraft(makeDraft('first_purchase'))
    draft.email_sequence[0].templates.en.body_html = ''
    const html = renderEditor('first_purchase', draft)

    expect(html).toContain('name="email_sequence.0.templates.en.body_html"')
    expect(html).toContain('&lt;!doctype html&gt;')
    expect(html).not.toContain('name="email_sequence.0.templates.en.body_text"')
  })
})
