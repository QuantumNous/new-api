import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { api } from '@/lib/api'
import { RecallApiError, recallCampaignKeys } from '../api'
import type { RecallActivitySMTPStatus } from '../types'

const originalAdapter = api.defaults.adapter
const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

const translatedI18n = createInstance()
await translatedI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'SMTP server is required.': 'Translated server required',
        'SMTP port must be between 1 and 65535.':
          'Translated port range required',
      },
    },
  },
  interpolation: { escapeValue: false },
})

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
      if (!event.target) {
        Object.defineProperty(event, 'target', {
          configurable: true,
          value: this,
        })
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
    checked = false
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

    setAttribute(key: string, value: string) {
      this.attributes[key] = String(value)
      if (key === 'disabled') this.disabled = true
      if (key === 'value') this.value = String(value)
      if (key === 'checked') this.checked = true
    }

    getAttribute(key: string) {
      return this.attributes[key] ?? null
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
      if (key === 'checked') this.checked = false
    }

    querySelector(selector: string): ElementShim | null {
      if (
        selector.startsWith('#') &&
        this.attributes.id === selector.slice(1)
      ) {
        return this
      }
      if (selector.toUpperCase() === this.tagName) {
        return this
      }
      for (const child of this.childNodes) {
        if (child instanceof ElementShim) {
          const match = child.querySelector(selector)
          if (match) return match
        }
      }
      return null
    }

    focus() {}
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
  const body = new ElementShim('body')
  const shimDocument = {
    nodeType: 9,
    body,
    head,
    createElement: (tagName: string) => new ElementShim(tagName),
    createElementNS: (_namespace: string, tagName: string) =>
      new ElementShim(tagName),
    createTextNode: (text: string) => new TextShim(text),
    getElementsByTagName: (tagName: string) =>
      tagName.toLowerCase() === 'head' ? [head] : [],
    querySelector: (selector: string) => body.querySelector(selector),
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
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('MouseEvent', Event)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

const latestInputProps: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement>
> = {}
const latestButtonProps: Record<
  string,
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = {}

mock.module('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    if (typeof props.children === 'string') {
      latestButtonProps[props.children] = props
    }
    return <button {...props} />
  },
}))

mock.module('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    if (props.id) latestInputProps[props.id] = props
    return <input {...props} />
  },
}))

mock.module('@/components/ui/checkbox', () => ({
  Checkbox: (
    props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
      onCheckedChange?: (checked: boolean) => void
    }
  ) => (
    <input
      checked={props.checked}
      disabled={props.disabled}
      type='checkbox'
      onChange={(event) => props.onCheckedChange?.(event.currentTarget.checked)}
    />
  ),
}))

mock.module('@/components/ui/label', () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props} />
  ),
}))

const {
  CampaignSMTPSettings,
  CampaignSMTPSettingsView,
  createRecallActivitySMTPFormValues,
  getRecallActivitySMTPSaveSuccessState,
  normalizeRecallActivitySMTPInput,
  recallActivitySMTPSchema,
} = await import('./campaign-smtp-settings')

beforeAll(() => {
  api.defaults.adapter = originalAdapter
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  for (const key of Object.keys(latestInputProps)) delete latestInputProps[key]
  for (const key of Object.keys(latestButtonProps)) {
    delete latestButtonProps[key]
  }
})

afterAll(() => {
  restoreTestGlobals()
})

function makeStatus(
  overrides: Partial<RecallActivitySMTPStatus> = {}
): RecallActivitySMTPStatus {
  return {
    server: 'smtp.example.com',
    port: 587,
    account: 'activity-user',
    email_from: 'activity@example.com',
    ssl_enabled: false,
    force_auth_login: true,
    token_configured: true,
    configured: true,
    reply_to: '',
    unsubscribe_mailto: '',
    ...overrides,
  }
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(
  predicate: () => boolean,
  timeout = 1000
): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeout) {
      throw new Error('Timed out waiting for assertion')
    }
    await React.act(async () => {
      await wait(10)
    })
  }
}

function renderMountedSMTPSettings(): {
  container: HTMLElement
  queryClient: QueryClient
  root: Root
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  React.act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignSMTPSettings />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })

  return { container, queryClient, root }
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

function submitSMTPSettingsForm(container: HTMLElement) {
  const form = container.querySelector('form')
  if (!form) throw new Error('SMTP settings form was not rendered')
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function findButtonByText(
  root: HTMLElement,
  text: string
): HTMLButtonElement | null {
  const visit = (node: Node): HTMLButtonElement | null => {
    if (
      node instanceof HTMLElement &&
      node.tagName === 'BUTTON' &&
      node.textContent === text
    ) {
      return node as HTMLButtonElement
    }
    for (const child of Array.from(node.childNodes)) {
      const match = visit(child)
      if (match) return match
    }
    return null
  }
  return visit(root)
}

async function clickButton(button: HTMLButtonElement) {
  await React.act(async () => {
    const label = button.textContent ?? ''
    latestButtonProps[label]?.onClick?.(
      new MouseEvent('click') as unknown as React.MouseEvent<HTMLButtonElement>
    )
    await wait()
  })
}

async function expandSMTPSettingsForEdit(container: HTMLElement) {
  const editButton = findButtonByText(container, 'Edit')
  if (editButton) await clickButton(editButton)
}

function setApiResponses(
  handler: (config: InternalAxiosRequestConfig) => Promise<unknown>
) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    return {
      data: await handler(config),
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    }
  }
}

describe('CampaignSMTPSettings', () => {
  test('initializes all SMTP form fields from redacted status and keeps token blank', () => {
    expect(createRecallActivitySMTPFormValues(makeStatus())).toEqual({
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '',
      ssl_enabled: false,
      force_auth_login: true,
      reply_to: '',
      unsubscribe_mailto: '',
    })

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{}}
          expanded={true}
          pending={false}
          status={makeStatus()}
          success=''
          values={createRecallActivitySMTPFormValues(makeStatus())}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Activity SMTP settings')
    expect(html).toContain('w-full')
    expect(html).toContain('min-w-0')
    expect(html).not.toContain('min-w-80')
    expect(html).toContain('Configured')
    expect(html).toContain('value="smtp.example.com"')
    expect(html).toContain('type="password"')
    expect(html).not.toContain('real password')
  })

  test('renders configured SMTP as a compact collapsed summary without form inputs or token', () => {
    const status = makeStatus()
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{}}
          expanded={false}
          pending={false}
          status={status}
          success=''
          values={{
            ...createRecallActivitySMTPFormValues(status),
            token: 'typed secret',
          }}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Activity SMTP settings')
    expect(html).toContain('activity@example.com')
    expect(html).toContain('smtp.example.com:587')
    expect(html).toContain('Configured')
    expect(html).toContain('Edit')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="recall-smtp-settings-form"')
    expect(html).not.toContain('id="recall-smtp-server"')
    expect(html).not.toContain('id="recall-smtp-token"')
    expect(html).not.toContain('typed secret')
  })

  test('renders not configured state and requires first-save token', () => {
    const status = makeStatus({
      server: '',
      account: '',
      email_from: '',
      token_configured: false,
      configured: false,
    })
    const validation = recallActivitySMTPSchema(status).safeParse({
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '   ',
      ssl_enabled: false,
      force_auth_login: true,
      reply_to: '',
      unsubscribe_mailto: '',
    })

    expect(validation.success).toBe(false)
    expect(
      validation.error?.issues.some((issue) => issue.path[0] === 'token')
    ).toBe(true)

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{}}
          expanded={true}
          pending={false}
          status={status}
          success=''
          values={createRecallActivitySMTPFormValues(status)}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Not configured')
    expect(html).toContain('id="recall-smtp-server"')
    expect(html).toContain('id="recall-smtp-token"')
  })

  test('validates port range, integer shape, required host/account, and plain mailbox sender', () => {
    const valid = {
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '',
      ssl_enabled: false,
      force_auth_login: true,
      reply_to: '',
      unsubscribe_mailto: '',
    }

    for (const invalid of [
      { ...valid, port: 0 },
      { ...valid, port: 65536 },
      { ...valid, port: 25.5 },
      { ...valid, server: '   ' },
      { ...valid, account: '   ' },
      { ...valid, email_from: 'Activity <activity@example.com>' },
      { ...valid, email_from: 'activity@example.com\r\nbcc:x@example.com' },
      { ...valid, email_from: 'not-an-email' },
    ]) {
      expect(
        recallActivitySMTPSchema(makeStatus()).safeParse(invalid).success
      ).toBe(false)
    }
  })

  test('accepts blank deliverability fields but rejects malformed ones', () => {
    const valid = {
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '',
      ssl_enabled: false,
      force_auth_login: true,
      reply_to: '',
      unsubscribe_mailto: '',
    }

    // Both headers are optional; blank simply omits them.
    expect(
      recallActivitySMTPSchema(makeStatus()).safeParse(valid).success
    ).toBe(true)
    expect(
      recallActivitySMTPSchema(makeStatus()).safeParse({
        ...valid,
        reply_to: 'support@example.com',
        unsubscribe_mailto: 'mailto:unsubscribe@example.com',
      }).success
    ).toBe(true)

    for (const invalid of [
      { ...valid, reply_to: 'not-an-email' },
      { ...valid, reply_to: 'Support <support@example.com>' },
      // A bare address would be emitted as an unusable List-Unsubscribe URI.
      { ...valid, unsubscribe_mailto: 'unsubscribe@example.com' },
      { ...valid, unsubscribe_mailto: 'mailto:not-an-email' },
    ]) {
      expect(recallActivitySMTPSchema(makeStatus()).safeParse(invalid).success)
        .toBe(false)
    }
  })

  test('normalizes submit input while preserving meaningful token bytes', () => {
    expect(
      normalizeRecallActivitySMTPInput({
        server: ' smtp.example.com ',
        port: 465,
        account: ' activity-user ',
        email_from: ' activity@example.com ',
        token: '  exact password bytes  ',
        ssl_enabled: true,
        force_auth_login: false,
        reply_to: '',
        unsubscribe_mailto: '',
      })
    ).toEqual({
      server: 'smtp.example.com',
      port: 465,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '  exact password bytes  ',
      ssl_enabled: true,
      force_auth_login: false,
      reply_to: '',
      unsubscribe_mailto: '',
    })

    expect(
      normalizeRecallActivitySMTPInput({
        server: 'smtp.example.com',
        port: 587,
        account: 'activity-user',
        email_from: 'activity@example.com',
        token: '   ',
        ssl_enabled: false,
        force_auth_login: true,
        reply_to: '',
        unsubscribe_mailto: '',
      }).token
    ).toBe('')
  })

  test('failed save renders sanitized error inline and retains entered values', () => {
    const values = {
      server: ' smtp.example.com ',
      port: 2525,
      account: ' admin ',
      email_from: ' activity@example.com ',
      token: '  typed secret  ',
      ssl_enabled: true,
      force_auth_login: false,
      reply_to: '',
      unsubscribe_mailto: '',
    }
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error='Failed to update Activity SMTP settings.'
          fieldErrors={{}}
          expanded={true}
          pending={false}
          status={makeStatus()}
          success=''
          values={values}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Failed to update Activity SMTP settings.')
    expect(html).not.toContain('Backend rejected SMTP settings')
    expect(html).toContain('value=" smtp.example.com "')
    expect(html).toContain('value=" admin "')
    expect(html).toContain('value=" activity@example.com "')
    expect(html).toContain('value="  typed secret  "')
    expect(html).toContain('checked=""')
  })

  test('marks invalid SMTP inputs with stable accessible error descriptions', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{
            account: 'SMTP account is required.',
            email_from: 'Sender must be a plain email address.',
            port: 'SMTP port must be between 1 and 65535.',
            server: 'SMTP server is required.',
            token: 'SMTP token is required for first save.',
          }}
          expanded={true}
          pending={false}
          status={makeStatus({ token_configured: false })}
          success=''
          values={{
            account: '',
            email_from: '',
            force_auth_login: true,
            port: 0,
            reply_to: '',
            server: '',
            ssl_enabled: false,
            token: '',
            unsubscribe_mailto: '',
          }}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    for (const field of ['server', 'port', 'account', 'email-from']) {
      expect(html).toContain(`id="recall-smtp-${field}-error"`)
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain(`aria-describedby="recall-smtp-${field}-error"`)
    }
    expect(html).toContain('id="recall-smtp-token-help"')
    expect(html).toContain('id="recall-smtp-token-error"')
    expect(html).toContain(
      'aria-describedby="recall-smtp-token-help recall-smtp-token-error"'
    )
  })

  test('translates field validation errors before rendering FieldError alerts', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={translatedI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{
            port: 'SMTP port must be between 1 and 65535.',
            server: 'SMTP server is required.',
          }}
          expanded={true}
          pending={false}
          status={makeStatus()}
          success=''
          values={createRecallActivitySMTPFormValues(makeStatus())}
          onFieldChange={() => undefined}
          onEdit={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Translated server required')
    expect(html).toContain('Translated port range required')
    expect(html).not.toContain('SMTP server is required.')
    expect(html).not.toContain('SMTP port must be between 1 and 65535.')
  })

  test('successful save updates status and resets only the password input', () => {
    const nextStatus = makeStatus({
      server: 'smtp.saved.example.com',
      token_configured: true,
      configured: true,
    })

    expect(getRecallActivitySMTPSaveSuccessState(nextStatus)).toEqual({
      values: {
        server: 'smtp.saved.example.com',
        port: 587,
        account: 'activity-user',
        email_from: 'activity@example.com',
        token: '',
        ssl_enabled: false,
        force_auth_login: true,
        reply_to: '',
        unsubscribe_mailto: '',
      },
      status: nextStatus,
      success: 'Activity SMTP settings saved.',
    })
  })

  test('shows neutral loading while the SMTP status query is pending', async () => {
    let resolveStatus:
      | ((value: { success: boolean; data: RecallActivitySMTPStatus }) => void)
      | undefined
    setApiResponses(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve
        })
    )

    const { container, root } = renderMountedSMTPSettings()

    expect(container.textContent).toContain('Loading SMTP settings')
    expect(container.textContent).not.toContain('Not configured')

    await waitFor(() => typeof resolveStatus === 'function')
    await React.act(async () => {
      resolveStatus?.({ success: true, data: makeStatus() })
      await wait()
    })
    dispose(root)
  })

  test('expands configured SMTP for editing and collapses only after successful save', async () => {
    const requests: string[] = []
    setApiResponses(async (config) => {
      requests.push(`${config.method}:${config.url}`)
      if (config.method === 'put') {
        return {
          success: true,
          data: makeStatus({ server: 'smtp.saved.example.com' }),
        }
      }
      return { success: true, data: makeStatus() }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(
      () =>
        findButtonByText(container, 'Edit')?.getAttribute('aria-expanded') ===
        'false'
    )
    expect(container.textContent).toContain('activity@example.com')
    expect(container.textContent).toContain('smtp.example.com:587')
    expect(container.querySelector('#recall-smtp-server')).toBeNull()

    await clickButton(findButtonByText(container, 'Edit') as HTMLButtonElement)
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'smtp.example.com'
    )

    await React.act(async () => {
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(
      () =>
        container.textContent?.includes('Activity SMTP settings saved.') ===
        true
    )
    await waitFor(
      () => requests.filter((request) => request.startsWith('get:')).length >= 2
    )
    expect(container.querySelector('#recall-smtp-server')).toBeNull()
    expect(
      findButtonByText(container, 'Edit')?.getAttribute('aria-expanded')
    ).toBe('false')
    dispose(root)
  })

  test('submits deliverability fields from the expanded SMTP form', async () => {
    const putPayloads: unknown[] = []
    setApiResponses(async (config) => {
      if (config.method === 'put') {
        putPayloads.push(
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        )
        return {
          success: true,
          data: makeStatus({
            reply_to: 'support@example.com',
            unsubscribe_mailto: 'mailto:unsubscribe@example.com',
          }),
        }
      }
      return { success: true, data: makeStatus() }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await waitFor(
      () =>
        container.querySelector('#recall-smtp-reply-to') !== null &&
        container.querySelector('#recall-smtp-unsubscribe-mailto') !== null
    )
    await React.act(async () => {
      latestInputProps['recall-smtp-reply-to']?.onChange?.({
        target: { value: 'support@example.com' },
      } as React.ChangeEvent<HTMLInputElement>)
      latestInputProps['recall-smtp-unsubscribe-mailto']?.onChange?.({
        target: { value: 'mailto:unsubscribe@example.com' },
      } as React.ChangeEvent<HTMLInputElement>)
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(() => putPayloads.length === 1)
    expect(putPayloads[0]).toEqual(
      expect.objectContaining({
        reply_to: 'support@example.com',
        unsubscribe_mailto: 'mailto:unsubscribe@example.com',
      })
    )
    dispose(root)
  })

  test('keeps success visible after save cache update and invalidate refetch', async () => {
    const requests: string[] = []
    setApiResponses(async (config) => {
      requests.push(`${config.method}:${config.url}`)
      if (config.method === 'put') {
        return {
          success: true,
          data: makeStatus({ server: 'smtp.saved.example.com' }),
        }
      }
      return { success: true, data: makeStatus() }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await React.act(async () => {
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(
      () =>
        container.textContent?.includes('Activity SMTP settings saved.') ===
        true
    )
    await waitFor(
      () => requests.filter((request) => request.startsWith('get:')).length >= 2
    )
    expect(container.textContent).toContain('Activity SMTP settings saved.')
    dispose(root)
  })

  test('allows an immediate second blank-token save after first save configures the token', async () => {
    const putPayloads: unknown[] = []
    setApiResponses(async (config) => {
      if (config.method === 'put') {
        putPayloads.push(
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        )
        return {
          success: true,
          data: makeStatus({ token_configured: true, configured: true }),
        }
      }
      return {
        success: true,
        data:
          putPayloads.length > 0
            ? makeStatus({ token_configured: true, configured: true })
            : makeStatus({
                token_configured: false,
                configured: false,
              }),
      }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(
      () => container.textContent?.includes('Not configured') === true
    )
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'smtp.example.com'
    )
    await React.act(async () => {
      latestInputProps['recall-smtp-token']?.onChange?.({
        target: { value: 'first secret' },
      } as React.ChangeEvent<HTMLInputElement>)
      submitSMTPSettingsForm(container)
      await wait()
    })
    await waitFor(() => putPayloads.length === 1)

    await expandSMTPSettingsForEdit(container)
    await React.act(async () => {
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(() => putPayloads.length === 2)
    expect(putPayloads).toEqual([
      expect.objectContaining({ token: 'first secret' }),
      expect.objectContaining({ token: '' }),
    ])
    expect(container.textContent).not.toContain(
      'SMTP token is required for first save.'
    )
    dispose(root)
  })

  test('keeps dirty mounted inputs when a background SMTP status refetch completes', async () => {
    let getCount = 0
    setApiResponses(async (config) => {
      if (config.method !== 'get') {
        return { success: true, data: makeStatus() }
      }
      getCount += 1
      return {
        success: true,
        data:
          getCount === 1
            ? makeStatus({
                account: 'initial-account',
                email_from: 'initial@example.com',
                server: 'initial.example.com',
              })
            : makeStatus({
                account: 'refetched-account',
                email_from: 'refetched@example.com',
                server: 'refetched.example.com',
              }),
      }
    })
    const { container, queryClient, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'initial.example.com'
    )
    await React.act(async () => {
      latestInputProps['recall-smtp-server']?.onChange?.({
        target: { value: 'typed.example.com' },
      } as React.ChangeEvent<HTMLInputElement>)
      latestInputProps['recall-smtp-account']?.onChange?.({
        target: { value: 'typed-account' },
      } as React.ChangeEvent<HTMLInputElement>)
      latestInputProps['recall-smtp-email-from']?.onChange?.({
        target: { value: 'typed@example.com' },
      } as React.ChangeEvent<HTMLInputElement>)
      latestInputProps['recall-smtp-token']?.onChange?.({
        target: { value: 'typed secret' },
      } as React.ChangeEvent<HTMLInputElement>)
      await wait()
    })

    await React.act(async () => {
      await queryClient.invalidateQueries({ queryKey: recallCampaignKeys.smtp })
      await wait()
    })

    await waitFor(() => getCount >= 2)
    expect(
      findButtonByText(container, 'Edit')?.getAttribute('aria-expanded')
    ).toBe('true')
    expect(
      (container.querySelector('#recall-smtp-server') as HTMLInputElement).value
    ).toBe('typed.example.com')
    expect(
      (container.querySelector('#recall-smtp-account') as HTMLInputElement)
        .value
    ).toBe('typed-account')
    expect(
      (container.querySelector('#recall-smtp-email-from') as HTMLInputElement)
        .value
    ).toBe('typed@example.com')
    expect(
      (container.querySelector('#recall-smtp-token') as HTMLInputElement).value
    ).toBe('typed secret')
    dispose(root)
  })

  test('retains mounted form values and hides raw backend alert after failed save', async () => {
    setApiResponses(async (config) => {
      if (config.method === 'put') {
        return {
          success: false,
          message:
            'backend refused AUTH for activity@example.com with Message-ID <secret@example.com>',
        }
      }
      return {
        success: true,
        data: makeStatus({
          account: 'entered-account',
          email_from: 'entered@example.com',
          server: 'entered.example.com',
        }),
      }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'entered.example.com'
    )
    await React.act(async () => {
      latestInputProps['recall-smtp-token']?.onChange?.({
        target: { value: '  typed secret  ' },
      } as React.ChangeEvent<HTMLInputElement>)
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(
      () =>
        container.textContent?.includes(
          'Failed to update Activity SMTP settings.'
        ) === true
    )
    expect(container.textContent).toContain(
      'Failed to update Activity SMTP settings.'
    )
    expect(
      findButtonByText(container, 'Edit')?.getAttribute('aria-expanded')
    ).toBe('true')
    expect(container.textContent).not.toContain('backend refused AUTH')
    expect(container.textContent).not.toContain('activity@example.com')
    expect(container.textContent).not.toContain('secret@example.com')
    expect(container.textContent).toContain('SMTP token')
    expect(
      (container.querySelector('#recall-smtp-server') as HTMLInputElement).value
    ).toBe('entered.example.com')
    expect(
      (container.querySelector('#recall-smtp-account') as HTMLInputElement)
        .value
    ).toBe('entered-account')
    expect(
      (container.querySelector('#recall-smtp-email-from') as HTMLInputElement)
        .value
    ).toBe('entered@example.com')
    expect(
      (container.querySelector('#recall-smtp-token') as HTMLInputElement).value
    ).toBe('  typed secret  ')
    dispose(root)
  })

  test('maps known backend validation messages to existing translated SMTP copy', async () => {
    setApiResponses(async (config) => {
      if (config.method === 'put') {
        return { success: false, message: 'SMTP server is required' }
      }
      return { success: true, data: makeStatus() }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'smtp.example.com'
    )
    await React.act(async () => {
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(
      () => container.textContent?.includes('SMTP server is required.') === true
    )
    expect(container.textContent).toContain('SMTP server is required.')
    expect(container.textContent).not.toContain('SMTP server is required</')
    dispose(root)
  })

  test('maps stable Activity SMTP save error codes and ignores raw details', async () => {
    setApiResponses(async (config) => {
      if (config.method === 'put') {
        throw new RecallApiError('raw SMTP transport detail', {
          code: 'activity_smtp_send_failed',
          message: 'raw SMTP transport detail',
        })
      }
      return { success: true, data: makeStatus() }
    })
    const { container, root } = renderMountedSMTPSettings()

    await waitFor(() => container.textContent?.includes('Configured') === true)
    await expandSMTPSettingsForEdit(container)
    await waitFor(
      () =>
        (container.querySelector('#recall-smtp-server') as HTMLInputElement)
          ?.value === 'smtp.example.com'
    )
    await React.act(async () => {
      submitSMTPSettingsForm(container)
      await wait()
    })

    await waitFor(
      () =>
        container.textContent?.includes(
          'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ) === true
    )
    expect(container.textContent).not.toContain('raw SMTP transport detail')
    dispose(root)
  })
})
