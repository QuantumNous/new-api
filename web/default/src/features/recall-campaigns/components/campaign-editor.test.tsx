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
import type { RecallAudienceTemplate, RecallCampaignDraft } from '../types'

const commonHelp =
  'Audience templates define the base audience. The rules shown below narrow it further, and built-in eligibility filters also apply. Preview the audience before activation.'
const firstPurchaseHelp =
  'Targets registered users who have never paid, for campaigns that encourage a first purchase.'
const groupHelp =
  'Choose Allow or Block, then select the user groups to include or exclude. With no group filter, eligible users from every group are included.'
const automaticTranslationHelp =
  "Email content is translated automatically when saved, sent in each user's language, and falls back to English when unavailable."
const testI18n = createInstance()
const createMutation = mock(async (draft: RecallCampaignDraft) => ({
  success: true,
  data: { id: 123, name: draft.name },
}))
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
const latestInputProps: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement>
> = {}

spyOn(recallApi, 'useRecallCampaignMutations').mockImplementation(() => ({
  create: { isPending: false, mutateAsync: createMutation },
  update: { isPending: false, mutateAsync: createMutation },
  action: {
    isPending: false,
    mutateAsync: mock(async () => ({ success: true })),
  },
  retry: {
    isPending: false,
    mutateAsync: mock(async () => ({ success: true })),
  },
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
      : undefined
    if (name === 'audience_template') {
      latestAudienceTemplateChange = props.onValueChange
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
      coupon_redeem_by: 0,
    },
    product_scope: {
      topup_price_ids: ['price_topup_usd'],
      subscription_price_ids: [],
    },
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
          [automaticTranslationHelp]: automaticTranslationHelp,
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  latestSpecifiedUsersProps = undefined
  latestAudienceTemplateChange = undefined
  for (const key of Object.keys(latestInputProps)) {
    delete latestInputProps[key]
  }
  createMutation.mockClear()
})

afterAll(() => {
  mock.restore()
  restoreTestGlobals()
})

describe('CampaignEditor audience rules', () => {
  test('offers all five audience template values with source descriptions', () => {
    const html = renderEditor('first_purchase')

    for (const [value, label] of [
      ['first_purchase', 'First purchase'],
      ['lapsed_payer', 'Lapsed payer'],
      ['expired_subscription', 'Expired subscription'],
      ['registered_only', 'Registered only'],
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

  test('disables native validation so registered-only empty dates reach schema errors', () => {
    const html = renderEditor('registered_only')

    expect(html).toContain('<form')
    expect(html).toContain('noValidate=""')
    expect(html).toContain('required=""')
    expect(html).toContain('name="audience_config.registration_start_at"')
    expect(html).toContain('name="audience_config.registration_end_at"')
  })

  test('wires registration datetime edits to submitted Unix seconds', async () => {
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
      latestInputProps['recall-registration-end-at'].onChange?.({
        target: {
          name: 'audience_config.registration_end_at',
          value: '2031-01-03T03:04',
        },
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>)
    })
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

  test('renders only English HTML template fields', () => {
    const draft = makeDraft('first_purchase')
    const html = renderEditor('first_purchase', draft)

    expect(html).not.toContain('Template language')
    expect(html).toContain('name="email_sequence.0.templates.en.subject"')
    expect(html).toContain('name="email_sequence.0.templates.en.body_html"')
    expect(html).not.toContain('name="email_sequence.0.templates.en.body_text"')
    expect(html).not.toContain('templates.fr')
  })

  test('loads legacy text as visible editable HTML without UTF-16 native limits', () => {
    const html = renderEditor('first_purchase')
    const subjectInput = html.match(
      /<input[^>]*name="email_sequence\.0\.templates\.en\.subject"[^>]*>/
    )?.[0]
    const bodyInput = html.match(
      /<textarea[^>]*name="email_sequence\.0\.templates\.en\.body_html"[^>]*>/
    )?.[0]

    expect(html.replaceAll('&#x27;', "'")).toContain(automaticTranslationHelp)
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

    expect(html).toContain('for="recall-email-0-subject"')
    expect(subjectInput).toContain('id="recall-email-0-subject"')
    expect(subjectInput).toContain('aria-invalid="false"')
    expect(subjectInput).toContain(
      'aria-describedby="recall-email-0-subject-help"'
    )
    expect(html).toContain('for="recall-email-0-body-html"')
    expect(bodyInput).toContain('id="recall-email-0-body-html"')
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
