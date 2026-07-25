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
  test,
  vi,
} from 'bun:test'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'

type MockUser = {
  id: number
  username: string
  display_name: string
  email: string
  status: number
}

type MockMultiSelectProps = {
  disabled?: boolean
  id?: string
  onChange: (value: string[]) => void
  onSearchChange?: (value: string) => void
  options: { label: string; value: string }[]
  selected: string[]
}

type MockTextareaProps = {
  disabled?: boolean
  id?: string
  onBlur?: () => void
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
  value?: string
}

const apiCalls: Array<{ ids?: number[]; keyword?: string }> = []
const userFixtures = new Map<string, MockUser[]>()
let latestMultiSelectProps: MockMultiSelectProps | undefined
let latestTextareaProps: MockTextareaProps | undefined

const recallCampaignKeys = {
  audienceUsers: (params: { keyword?: string; ids?: number[] }) =>
    ['recall-campaigns', 'audience-options', 'users', params] as const,
}

const listRecallAudienceUsers = mock(
  async (params: { ids?: number[]; keyword?: string }) => {
    apiCalls.push(params)
    const key = params.ids?.length
      ? `ids:${params.ids.join(',')}`
      : `keyword:${params.keyword ?? ''}`
    return {
      success: true,
      data: userFixtures.get(key) ?? [],
    }
  }
)

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

    addEventListener() {}
    removeEventListener() {}
  }

  class ElementShim extends NodeShim {
    attributes: Record<string, string> = {}
    disabled = false
    localName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    style = {}
    tagName: string
    value = ''
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
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
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

mock.module('../api', () => ({
  listRecallAudienceUsers,
  recallCampaignKeys,
}))

mock.module('../api.ts', () => ({
  listRecallAudienceUsers,
  recallCampaignKeys,
}))

mock.module('@/features/recall-campaigns/api', () => ({
  listRecallAudienceUsers,
  recallCampaignKeys,
}))

mock.module('@/components/multi-select', () => ({
  MultiSelect: (props: MockMultiSelectProps) => {
    latestMultiSelectProps = props
    const labels = new Map(
      props.options.map((option) => [option.value, option.label])
    )
    return (
      <div>
        <input id={props.id} disabled={props.disabled} />
        {props.selected.map((value) => (
          <span key={value}>{labels.get(value) ?? value}</span>
        ))}
      </div>
    )
  },
}))

mock.module('@/components/ui/textarea', () => ({
  Textarea: (props: MockTextareaProps) => {
    latestTextareaProps = props
    return (
      <textarea
        id={props.id}
        disabled={props.disabled}
        onBlur={props.onBlur}
        onChange={props.onChange}
        value={props.value}
      />
    )
  },
}))

const { CampaignSpecifiedUsersSelector } =
  await import('./campaign-specified-users-selector')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  vi.useRealTimers()
  apiCalls.length = 0
  userFixtures.clear()
  listRecallAudienceUsers.mockClear()
  latestMultiSelectProps = undefined
  latestTextareaProps = undefined
})

afterAll(() => {
  restoreTestGlobals()
})

function user(id: number, overrides: Partial<MockUser> = {}): MockUser {
  return {
    id,
    username: `user-${id}`,
    display_name: `User ${id}`,
    email: `user-${id}@example.com`,
    status: 1,
    ...overrides,
  }
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function flushReactWork() {
  await Promise.resolve()
  await Promise.resolve()
}

function renderSelector(
  props: {
    userIDs?: number[]
    emails?: string[]
    immutable?: boolean
    onUserIDsChange?: (value: number[]) => void
    onEmailsChange?: (value: string[]) => void
  } = {}
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  const currentProps = {
    userIDs: props.userIDs ?? [],
    emails: props.emails ?? [],
    immutable: props.immutable ?? false,
    onUserIDsChange: props.onUserIDsChange ?? (() => undefined),
    onEmailsChange: props.onEmailsChange ?? (() => undefined),
  }

  function render(nextProps = currentProps) {
    React.act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <I18nextProvider i18n={testI18n}>
            <CampaignSpecifiedUsersSelector {...nextProps} />
          </I18nextProvider>
        </QueryClientProvider>
      )
    })
  }

  render()
  return { client, container, render, root }
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

function optionLabels(): string[] {
  return latestMultiSelectProps?.options.map((option) => option.label) ?? []
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

describe('CampaignSpecifiedUsersSelector', () => {
  test('debounces keyword search and never sends an empty broad request', async () => {
    userFixtures.set('keyword:ada', [user(1, { username: 'ada' })])
    const { root } = renderSelector()
    await waitFor(() => latestMultiSelectProps !== undefined)

    vi.useFakeTimers()
    await React.act(async () => {
      latestMultiSelectProps?.onSearchChange?.('  ada  ')
    })

    vi.advanceTimersByTime(299)
    await flushReactWork()
    expect(apiCalls).toEqual([])

    await React.act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(apiCalls).toEqual([{ keyword: 'ada' }])
    expect(apiCalls).not.toContainEqual({})
    vi.useRealTimers()
    dispose(root)
  })

  test('resolves selected IDs separately and keeps the selected chip while search results change', async () => {
    userFixtures.set('ids:42', [
      user(42, {
        username: 'ada',
        display_name: 'Ada',
        email: 'ada@example.com',
      }),
    ])
    userFixtures.set('keyword:grace', [
      user(7, {
        username: 'grace',
        display_name: '',
        email: 'grace@example.com',
      }),
    ])
    userFixtures.set('keyword:linus', [
      user(8, {
        username: 'linus',
        display_name: '',
        email: 'linus@example.com',
      }),
    ])
    const { container, root } = renderSelector({ userIDs: [42] })

    await waitFor(() => apiCalls.some((call) => call.ids?.[0] === 42))
    await waitFor(() => container.textContent?.includes('Ada') === true)

    React.act(() => {
      latestMultiSelectProps?.onSearchChange?.('grace')
    })
    await waitFor(() => apiCalls.some((call) => call.keyword === 'grace'))
    expect(apiCalls).toContainEqual({ ids: [42] })
    expect(apiCalls).toContainEqual({ keyword: 'grace' })
    await waitFor(() => container.textContent?.includes('Ada') === true)

    React.act(() => {
      latestMultiSelectProps?.onSearchChange?.('linus')
    })
    await waitFor(() => apiCalls.some((call) => call.keyword === 'linus'))
    await waitFor(() => container.textContent?.includes('Ada') === true)
    dispose(root)
  })

  test('formats selected user option labels with stable separators', async () => {
    userFixtures.set('ids:42,99', [
      user(42, {
        username: 'ada',
        display_name: 'Ada',
        email: 'ada@example.com',
      }),
    ])
    const { root } = renderSelector({ userIDs: [42, 99] })

    await waitFor(() => optionLabels().some((label) => label.includes('Ada')))

    expect(optionLabels()).toEqual([
      'Ada - ada@example.com - #42',
      'Unavailable - #99',
    ])
    expect(optionLabels().join(' ')).not.toContain('路')
    dispose(root)
  })

  test('treats empty and cleared keyword searches as authoritative for unselected options', async () => {
    userFixtures.set('keyword:ada', [
      user(1, {
        username: 'ada',
        display_name: 'Ada',
        email: 'ada@example.com',
      }),
    ])
    userFixtures.set('keyword:zzzz', [])
    const { container, root } = renderSelector()
    await waitFor(() => latestMultiSelectProps !== undefined)

    React.act(() => {
      latestMultiSelectProps?.onSearchChange?.('ada')
    })
    await waitFor(() => apiCalls.some((call) => call.keyword === 'ada'))
    await waitFor(() => optionLabels().some((label) => label.includes('Ada')))

    React.act(() => {
      latestMultiSelectProps?.onSearchChange?.('zzzz')
    })
    await waitFor(() => apiCalls.some((call) => call.keyword === 'zzzz'))
    await waitFor(() => optionLabels().length === 0)
    expect(optionLabels().join(' ')).not.toContain('Ada')
    expect(container.textContent).not.toContain('Ada')

    React.act(() => {
      latestMultiSelectProps?.onSearchChange?.('')
    })
    await waitFor(() => optionLabels().length === 0)
    expect(optionLabels().join(' ')).not.toContain('Ada')
    expect(container.textContent).not.toContain('Ada')
    dispose(root)
  })

  test('reports invalid manual email input while passing invalid tokens to the parent', async () => {
    const emailChanges: string[][] = []
    const { container, root } = renderSelector({
      userIDs: [42],
      emails: [],
      onEmailsChange: (value) => emailChanges.push(value),
    })
    await waitFor(() => latestTextareaProps !== undefined)

    React.act(() => {
      latestTextareaProps?.onChange?.({
        target: { value: 'Ada@Example.com, bad-token, ada@example.com' },
      })
    })
    await wait()

    expect(emailChanges).toEqual([['ada@example.com', 'bad-token']])
    expect(container.textContent).toContain('Invalid email entries')
    expect(container.textContent).toContain('bad-token')
    expect(container.textContent).toContain('2 / 500')
    dispose(root)
  })

  test('normalizes and dedupes valid manual email input', async () => {
    const emailChanges: string[][] = []
    const { root } = renderSelector({
      onEmailsChange: (value) => emailChanges.push(value),
    })
    await waitFor(() => latestTextareaProps !== undefined)

    React.act(() => {
      latestTextareaProps?.onChange?.({
        target: {
          value: 'Ada@Example.com, ada@example.com\nGrace@Example.com',
        },
      })
    })
    await wait()

    expect(emailChanges).toEqual([['ada@example.com', 'grace@example.com']])
    dispose(root)
  })

  test('keeps an active raw draft across matching parent rerenders and reconstructs changed loaded emails', async () => {
    const { render, root } = renderSelector({
      emails: ['loaded@example.com'],
    })
    await waitFor(() => latestTextareaProps?.value === 'loaded@example.com')

    React.act(() => {
      latestTextareaProps?.onChange?.({
        target: { value: 'Draft@Example.com, bad-token' },
      })
    })
    await waitFor(
      () => latestTextareaProps?.value === 'Draft@Example.com, bad-token'
    )

    render({
      userIDs: [],
      emails: ['draft@example.com', 'bad-token'],
      immutable: false,
      onUserIDsChange: () => undefined,
      onEmailsChange: () => undefined,
    })
    await wait()
    expect(latestTextareaProps?.value).toBe('Draft@Example.com, bad-token')

    render({
      userIDs: [],
      emails: ['loaded@example.com'],
      immutable: false,
      onUserIDsChange: () => undefined,
      onEmailsChange: () => undefined,
    })
    await wait()
    expect(latestTextareaProps?.value).toBe('Draft@Example.com, bad-token')

    render({
      userIDs: [],
      emails: ['loaded-different@example.com'],
      immutable: false,
      onUserIDsChange: () => undefined,
      onEmailsChange: () => undefined,
    })
    await wait()
    expect(latestTextareaProps?.value).toBe('loaded-different@example.com')
    dispose(root)
  })

  test('normalizes valid draft on blur without snapping back to stale props', async () => {
    const emailChanges: string[][] = []
    const { render, root } = renderSelector({
      emails: ['loaded@example.com'],
      onEmailsChange: (value) => emailChanges.push(value),
    })
    await waitFor(() => latestTextareaProps?.value === 'loaded@example.com')

    React.act(() => {
      latestTextareaProps?.onChange?.({
        target: {
          value: 'Ada@Example.com, ada@example.com\nGrace@Example.com',
        },
      })
    })
    await waitFor(
      () =>
        latestTextareaProps?.value ===
        'Ada@Example.com, ada@example.com\nGrace@Example.com'
    )

    React.act(() => {
      latestTextareaProps?.onBlur?.()
    })
    await waitFor(
      () => latestTextareaProps?.value === 'ada@example.com\ngrace@example.com'
    )

    render({
      userIDs: [],
      emails: ['ada@example.com', 'grace@example.com'],
      immutable: false,
      onUserIDsChange: () => undefined,
      onEmailsChange: (value) => emailChanges.push(value),
    })
    await wait()

    expect(latestTextareaProps?.value).toBe(
      'ada@example.com\ngrace@example.com'
    )
    expect(emailChanges).toEqual([
      ['ada@example.com', 'grace@example.com'],
      ['ada@example.com', 'grace@example.com'],
    ])
    dispose(root)
  })

  test('passes disabled control props for immutable campaigns', async () => {
    const { root } = renderSelector({
      immutable: true,
      emails: ['a@b.co'],
    })
    await waitFor(
      () =>
        latestMultiSelectProps !== undefined &&
        latestTextareaProps !== undefined
    )

    if (!latestMultiSelectProps?.disabled) {
      latestMultiSelectProps?.onChange(['1'])
    }
    if (!latestTextareaProps?.disabled) {
      latestTextareaProps?.onChange?.({ target: { value: 'b@c.co' } })
    }

    expect(latestMultiSelectProps?.disabled).toBe(true)
    expect(latestTextareaProps?.disabled).toBe(true)
    dispose(root)
  })
})
