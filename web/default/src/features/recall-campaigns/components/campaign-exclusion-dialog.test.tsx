import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import zhLocale from '../../../i18n/locales/zh.json'
import * as recallApi from '../api'
import type { RecallExclusionPreview } from '../types'

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
  if (typeof document !== 'undefined' && document.body) {
    defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    return
  }

  class NodeShim {
    childNodes: NodeShim[] = []
    nodeType = 0
    nodeName = ''
    parentNode: NodeShim | null = null
    private listeners: Record<string, EventListener[]> = {}
    appendChild(node: NodeShim) {
      this.childNodes.push(node)
      node.parentNode = this
      return node
    }
    insertBefore(node: NodeShim, before: NodeShim | null) {
      if (!before) return this.appendChild(node)
      const index = this.childNodes.indexOf(before)
      if (index === -1) return this.appendChild(node)
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
    files?: File[]
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
    getAttribute(key: string) {
      return this.attributes[key] ?? null
    }
    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
    }
    querySelector(selector: string): ElementShim | null {
      if (
        selector.startsWith('#') &&
        this.attributes.id === selector.slice(1)
      ) {
        return this
      }
      if (selector.toUpperCase() === this.tagName) return this
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
  const body = new ElementShim('body')
  const documentShim = {
    nodeType: 9,
    body,
    createElement: (tagName: string) => {
      const element = new ElementShim(tagName)
      Object.assign(element, { ownerDocument: documentShim })
      return element
    },
    createElementNS: (_namespace: string, tagName: string) => {
      const element = new ElementShim(tagName)
      Object.assign(element, { ownerDocument: documentShim })
      return element
    },
    createTextNode: (text: string) => new TextShim(text),
    addEventListener() {},
    removeEventListener() {},
    defaultView: globalThis,
  }
  Object.assign(body, { ownerDocument: documentShim })
  defineTestGlobal('document', documentShim as unknown as Document)
  defineTestGlobal(
    'window',
    globalThis as unknown as Window & typeof globalThis
  )
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('MouseEvent', Event)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

const previewCalls: File[] = []
const batchLoads: number[] = []
const confirmCalls: number[] = []
const invalidatedKeys: unknown[] = []
const latestInputs: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement>
> = {}
const latestButtons: Record<
  string,
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = {}
const testRecallCampaignKeys = recallApi.recallCampaignKeys
let previewError: Error | null = null
let confirmError: Error | null = null
let batchError: Error | null = null
let confirmResponse: RecallExclusionPreview | null = null
let pendingConfirmRequest: {
  batchId: number
  resolve: (value: { success: true; data: RecallExclusionPreview }) => void
  reject: (error: Error) => void
} | null = null
let pendingPreviewRequest: {
  file: File
  resolve: (value: { success: true; data: RecallExclusionPreview }) => void
  reject: (error: Error) => void
} | null = null

function makePreview(
  overrides: Partial<RecallExclusionPreview> = {}
): RecallExclusionPreview {
  return {
    batch_id: 73,
    total_rows: 3,
    resolved_users: 2,
    duplicate_rows: 1,
    unresolved_rows: 0,
    conflict_rows: 0,
    blocking_errors: [],
    warnings: [],
    cancelable_work: 5,
    confirmable: true,
    ...overrides,
  }
}

let nextPreview = makePreview()

mock.module('../api', () => ({
  ...recallApi,
  confirmRecallCampaignExclusionBatch: async (_id: number, batchId: number) => {
    confirmCalls.push(batchId)
    if (confirmError) throw confirmError
    if (pendingConfirmRequest) {
      return await new Promise<{ success: true; data: RecallExclusionPreview }>(
        (resolve, reject) => {
          pendingConfirmRequest = { batchId, resolve, reject }
        }
      )
    }
    return {
      success: true,
      data: confirmResponse ?? makePreview({ batch_id: batchId }),
    }
  },
  getRecallCampaignExclusionBatch: async (_id: number, batchId: number) => {
    batchLoads.push(batchId)
    if (batchError) throw batchError
    return { success: true, data: makePreview({ batch_id: batchId }) }
  },
  previewRecallCampaignExclusions: async (_id: number, file: File) => {
    previewCalls.push(file)
    if (previewError) throw previewError
    if (pendingPreviewRequest) {
      return await new Promise<{ success: true; data: RecallExclusionPreview }>(
        (resolve, reject) => {
          pendingPreviewRequest = { file, resolve, reject }
        }
      )
    }
    return { success: true, data: nextPreview }
  },
}))

mock.module('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    if (typeof props.children === 'string')
      latestButtons[props.children] = props
    return <button {...props} />
  },
}))

mock.module('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    if (props.id) latestInputs[props.id] = props
    return <input {...props} />
  },
}))

mock.module('@/components/ui/dialog', () => ({
  Dialog: (props: { open?: boolean; children: React.ReactNode }) =>
    props.open ? <div>{props.children}</div> : null,
  DialogContent: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <section {...props} />
  ),
  DialogDescription: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} />
  ),
  DialogFooter: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <footer {...props} />
  ),
  DialogHeader: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <header {...props} />
  ),
  DialogTitle: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} />
  ),
}))

const { CampaignExclusionDialog } = await import('./campaign-exclusion-dialog')

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'Row conflicts with a converted recipient.':
          'Translated converted-recipient conflict.',
      },
    },
    zh: {
      translation: zhLocale.translation,
    },
  },
  interpolation: { escapeValue: false },
})

function renderDialog(props: {
  initialBatchId?: number
  onOpenChange?: (open: boolean) => void
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient)
  queryClient.invalidateQueries = ((filters: { queryKey?: unknown }) => {
    invalidatedKeys.push(filters.queryKey)
    return originalInvalidate(filters)
  }) as QueryClient['invalidateQueries']
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  React.act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignExclusionDialog
            campaignId={42}
            initialBatchId={props.initialBatchId}
            open
            onOpenChange={props.onOpenChange ?? (() => undefined)}
          />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })
  return { container, queryClient, root }
}

function renderControlledDialog(props: { initialBatchId?: number }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient)
  queryClient.invalidateQueries = ((filters: { queryKey?: unknown }) => {
    invalidatedKeys.push(filters.queryKey)
    return originalInvalidate(filters)
  }) as QueryClient['invalidateQueries']
  let open = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignExclusionDialog
            campaignId={42}
            initialBatchId={props.initialBatchId}
            open={open}
            onOpenChange={(nextOpen) => {
              open = nextOpen
            }}
          />
        </I18nextProvider>
      </QueryClientProvider>
    )
  }
  React.act(render)
  return {
    container,
    queryClient,
    root,
    setOpen(nextOpen: boolean) {
      open = nextOpen
      React.act(render)
    },
  }
}

async function wait(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function click(label: string) {
  await React.act(async () => {
    latestButtons[label]?.onClick?.(
      new MouseEvent('click') as unknown as React.MouseEvent<HTMLButtonElement>
    )
    await wait()
  })
}

async function chooseFile(file: File) {
  await React.act(async () => {
    latestInputs['recall-exclusion-file']?.onChange?.({
      target: { files: [file], value: 'C:\\fakepath\\users.csv' },
    } as unknown as React.ChangeEvent<HTMLInputElement>)
    await wait()
  })
}

afterEach(async () => {
  await testI18n.changeLanguage('en')
  previewCalls.length = 0
  batchLoads.length = 0
  confirmCalls.length = 0
  invalidatedKeys.length = 0
  previewError = null
  confirmError = null
  batchError = null
  confirmResponse = null
  pendingConfirmRequest = null
  pendingPreviewRequest = null
  for (const key of Object.keys(latestInputs)) delete latestInputs[key]
  for (const key of Object.keys(latestButtons)) delete latestButtons[key]
  nextPreview = makePreview()
})

afterAll(() => {
  mock.restore()
  restoreTestGlobals()
})

describe('CampaignExclusionDialog', () => {
  test('uploads only for preview and clears raw file input after preview', async () => {
    const { container, root } = renderDialog({})
    const file = new File(['email\nraw@example.com\n'], 'users.csv', {
      type: 'text/csv',
    })

    await chooseFile(file)
    await click('Preview exclusions')

    expect(previewCalls).toEqual([file])
    expect(confirmCalls).toEqual([])
    expect(container.textContent).toContain('2 resolved users')
    expect(container.textContent).toContain('5 queued messages can be canceled')
    expect(
      latestInputs['recall-exclusion-file']?.value === '' ||
        latestInputs['recall-exclusion-file']?.value === undefined
    ).toBeTrue()
    expect(container.textContent).not.toContain('raw@example.com')

    React.act(() => root.unmount())
  })

  test('disables confirmation for blocking conflicts and renders bounded problem messages', async () => {
    nextPreview = makePreview({
      conflict_rows: 1,
      confirmable: false,
      blocking_errors: [
        {
          row: 2,
          code: 'already_converted',
          message: 'Row conflicts with a converted recipient.',
        },
      ],
    })

    const { container, root } = renderDialog({})
    await chooseFile(new File(['email\nblocked@example.com\n'], 'users.csv'))
    await click('Preview exclusions')

    expect(container.textContent).toContain(
      'Translated converted-recipient conflict.'
    )
    expect(latestButtons['Apply exclusions']?.disabled).toBeTrue()
    expect(container.textContent).not.toContain('blocked@example.com')

    React.act(() => root.unmount())
  })

  test('renders known exclusion problem codes with stable localized copy', async () => {
    await testI18n.changeLanguage('zh')
    nextPreview = makePreview({
      confirmable: false,
      blocking_errors: [
        {
          row: 3,
          code: 'campaign_member',
          message: 'backend campaign member detail',
        },
      ],
      warnings: [
        {
          row: 2,
          code: 'duplicate_identity',
          message: 'duplicate identity collapsed',
        },
      ],
    })
    const { container, root } = renderDialog({})

    await chooseFile(new File(['email\nada@example.com\n'], 'users.csv'))
    await click('预览排除项')

    expect(container.textContent).toContain('第 2 行: 已忽略重复的 CSV 行。')
    expect(container.textContent).toContain('第 3 行: 用户已加入此活动。')
    expect(container.textContent).not.toContain('duplicate identity collapsed')
    expect(container.textContent).not.toContain(
      'backend campaign member detail'
    )

    React.act(() => root.unmount())
  })

  test('limits rendered problem samples to twenty entries', async () => {
    nextPreview = makePreview({
      confirmable: false,
      blocking_errors: Array.from({ length: 25 }, (_value, index) => ({
        row: index + 1,
        code: 'invalid_email',
        message: `Safe fixed problem ${index + 1}`,
      })),
    })
    const { container, root } = renderDialog({})

    await chooseFile(new File(['email\nmany@example.com\n'], 'users.csv'))
    await click('Preview exclusions')

    expect(container.textContent).toContain('Safe fixed problem 20')
    expect(container.textContent).not.toContain('Safe fixed problem 21')
    expect(container.textContent).toContain('5 more problems not shown')

    React.act(() => root.unmount())
  })

  test('recovers saved preview by numeric batch id and refreshes metrics after confirm', async () => {
    const { container, root } = renderDialog({ initialBatchId: 88 })

    await React.act(async () => {
      await wait()
    })

    expect(batchLoads).toEqual([88])
    expect(container.textContent).toContain('2 resolved users')

    await click('Apply exclusions')

    expect(confirmCalls).toEqual([88])
    expect(invalidatedKeys).toContainEqual(testRecallCampaignKeys.metrics(42))
    expect(invalidatedKeys).toContainEqual(testRecallCampaignKeys.detail(42))
    expect(container.textContent).toContain('Exclusions applied.')
    expect(container.textContent).toContain('5 queued messages were canceled')

    React.act(() => root.unmount())
  })

  test('keeps preview confirmable and retries safely after confirm failure', async () => {
    const { container, root } = renderDialog({})
    await chooseFile(new File(['email\nconfirm@example.com\n'], 'users.csv'))
    await click('Preview exclusions')

    confirmError = new Error('raw confirm failure')
    await click('Apply exclusions')

    expect(container.textContent).toContain('Unable to apply exclusions.')
    expect(container.textContent).not.toContain('raw confirm failure')
    expect(container.textContent).toContain('2 resolved users')
    expect(latestButtons['Apply exclusions']?.disabled).toBeFalse()

    confirmError = null
    confirmResponse = makePreview({ batch_id: 73, cancelable_work: 7 })
    await click('Apply exclusions')

    expect(confirmCalls).toEqual([73, 73])
    expect(container.textContent).toContain('Exclusions applied.')
    expect(container.textContent).toContain('7 queued messages were canceled')
    expect(container.textContent).not.toContain('2 resolved users')
    expect(latestButtons['Apply exclusions']?.disabled).toBeTrue()

    React.act(() => root.unmount())
  })

  test('does not restore stale recovered preview after successful confirm or reopen', async () => {
    confirmResponse = makePreview({ batch_id: 88, cancelable_work: 7 })
    const openChanges: boolean[] = []
    const { container, root } = renderDialog({
      initialBatchId: 88,
      onOpenChange: (open) => openChanges.push(open),
    })

    await React.act(async () => {
      await wait()
    })
    await click('Apply exclusions')

    expect(container.textContent).toContain('7 queued messages were canceled')
    expect(container.textContent).not.toContain('2 resolved users')
    expect(latestButtons['Apply exclusions']?.disabled).toBeTrue()

    await click('Close')
    expect(openChanges).toContain(false)
    expect(container.textContent).not.toContain('2 resolved users')

    React.act(() => root.unmount())
  })

  test('shows unconfirmed recovered preview again after parent closes and reopens', async () => {
    const { container, root, setOpen } = renderControlledDialog({
      initialBatchId: 88,
    })

    await React.act(async () => {
      await wait()
    })
    expect(container.textContent).toContain('2 resolved users')

    await click('Close')
    setOpen(false)
    expect(container.textContent).not.toContain('2 resolved users')

    setOpen(true)
    await React.act(async () => {
      await wait()
    })

    expect(container.textContent).toContain('2 resolved users')
    expect(latestButtons['Apply exclusions']?.disabled).toBeFalse()

    React.act(() => root.unmount())
  })

  test('runs global confirm side effects after close without restoring recovered batch', async () => {
    pendingConfirmRequest = {
      batchId: 0,
      resolve: () => undefined,
      reject: () => undefined,
    }
    const { container, queryClient, root, setOpen } = renderControlledDialog({
      initialBatchId: 88,
    })

    await React.act(async () => {
      await wait()
    })
    await click('Apply exclusions')
    expect(confirmCalls).toEqual([88])

    await click('Close')
    setOpen(false)

    await React.act(async () => {
      pendingConfirmRequest?.resolve({
        success: true,
        data: makePreview({ batch_id: 88, cancelable_work: 7 }),
      })
      await wait()
    })

    const batchKey = ['recall-campaigns', 42, 'exclusion-batch', 88]
    expect(invalidatedKeys).toContainEqual(testRecallCampaignKeys.metrics(42))
    expect(invalidatedKeys).toContainEqual(testRecallCampaignKeys.detail(42))
    expect(invalidatedKeys).toContainEqual(batchKey)
    expect(
      (
        queryClient.getQueryData(batchKey) as {
          data?: RecallExclusionPreview
        }
      )?.data?.confirmable
    ).toBeFalse()
    expect(container.textContent).not.toContain('Exclusions applied.')

    setOpen(true)
    await React.act(async () => {
      await wait()
    })

    expect(container.textContent).not.toContain('2 resolved users')
    expect(latestButtons['Apply exclusions']?.disabled).toBeTrue()

    React.act(() => root.unmount())
  })

  test('clears raw state on confirm and close', async () => {
    const openChanges: boolean[] = []
    const { container, root } = renderDialog({
      onOpenChange: (open) => openChanges.push(open),
    })
    await chooseFile(new File(['email\nprivate@example.com\n'], 'users.csv'))
    await click('Preview exclusions')
    await click('Apply exclusions')

    expect(confirmCalls).toEqual([73])
    expect(container.textContent).not.toContain('private@example.com')

    await click('Close')
    await React.act(async () => {
      await wait()
    })

    expect(openChanges).toContain(false)
    expect(container.textContent).not.toContain('private@example.com')
    expect(container.textContent).not.toContain('2 resolved users')

    React.act(() => root.unmount())
  })

  test('clears File mutation variables and preview state after preview failure and close', async () => {
    previewError = new Error('safe preview failure')
    const { container, queryClient, root } = renderDialog({})
    await chooseFile(new File(['email\nfailed@example.com\n'], 'users.csv'))
    await click('Preview exclusions')

    expect(container.textContent).not.toContain('failed@example.com')
    expect(
      queryClient
        .getMutationCache()
        .getAll()
        .some((mutation) => mutation.state.variables instanceof File)
    ).toBeFalse()

    await click('Close')

    expect(container.textContent).not.toContain('failed@example.com')
    expect(container.textContent).not.toContain('2 resolved users')

    React.act(() => root.unmount())
  })

  test('clears raw state immediately and ignores late preview responses after close', async () => {
    pendingPreviewRequest = {
      file: new File([], 'placeholder.csv'),
      resolve: () => undefined,
      reject: () => undefined,
    }
    const { container, root } = renderDialog({})
    await chooseFile(new File(['email\nlate@example.com\n'], 'users.csv'))
    await click('Preview exclusions')
    await click('Preview exclusions')

    expect(previewCalls).toHaveLength(1)
    await click('Close')
    expect(container.textContent).not.toContain('late@example.com')
    expect(container.textContent).not.toContain('2 resolved users')

    await React.act(async () => {
      pendingPreviewRequest?.resolve({
        success: true,
        data: makePreview({ resolved_users: 9 }),
      })
      await wait()
    })

    expect(container.textContent).not.toContain('9 resolved users')
    expect(container.textContent).not.toContain('Unable to preview exclusions.')

    React.act(() => root.unmount())
  })

  test('shows a safe retryable error when recovered exclusion batch load fails', async () => {
    batchError = new Error('raw batch recovery failure')
    const { container, root } = renderDialog({ initialBatchId: 88 })

    await React.act(async () => {
      await wait()
    })

    expect(container.textContent).toContain('Unable to load exclusion batch.')
    expect(container.textContent).not.toContain('raw batch recovery failure')
    expect(container.textContent).toContain('Retry')

    batchError = null
    await click('Retry')
    await React.act(async () => {
      await wait()
    })

    expect(batchLoads).toEqual([88, 88])
    expect(container.textContent).toContain('2 resolved users')

    React.act(() => root.unmount())
  })
})
