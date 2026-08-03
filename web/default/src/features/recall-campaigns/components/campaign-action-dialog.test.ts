import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, describe, expect, mock, spyOn, test } from 'bun:test'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import * as recallApi from '../api'

mock.module('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', props, children),
  buttonVariants: () => '',
}))

mock.module('@/components/ui/dialog', () => ({
  Dialog: (props: {
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
    open?: boolean
  }) =>
    props.open
      ? React.createElement(React.Fragment, null, props.children)
      : null,
  DialogClose: (props: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children),
  DialogContent: (props: { children: React.ReactNode }) =>
    React.createElement('div', null, props.children),
  DialogDescription: (props: { children: React.ReactNode }) =>
    React.createElement('p', null, props.children),
  DialogFooter: (props: { children: React.ReactNode }) =>
    React.createElement('footer', null, props.children),
  DialogHeader: (props: { children: React.ReactNode }) =>
    React.createElement('header', null, props.children),
  DialogOverlay: (props: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children),
  DialogPortal: (props: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children),
  DialogTitle: (props: { children: React.ReactNode }) =>
    React.createElement('h2', null, props.children),
  DialogTrigger: (props: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children),
}))

mock.module('sonner', () => ({
  toast: {
    error: mock(() => undefined),
    success: mock(() => undefined),
  },
}))

const {
  CampaignActionDialog,
  getRecallLocalizationBlockers,
  handleRecallCampaignActionError,
} = await import('./campaign-action-dialog')

const { RecallApiError } = recallApi
const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

const retryMutation = mock(async () => ({ success: true }))
spyOn(recallApi, 'useRecallCampaignMutations').mockImplementation(() => ({
  create: { isPending: false, mutateAsync: mock() },
  update: { isPending: false, mutateAsync: mock() },
  action: { isPending: false, mutateAsync: mock() },
  retry: { isPending: false, mutateAsync: retryMutation },
  generate: { isPending: false, mutateAsync: mock() },
}))

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
    checked = false
    disabled = false
    localName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    style = {}
    tagName: string
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
      if (key === 'checked') this.checked = true
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
      if (key === 'checked') this.checked = false
    }

    querySelector(selector: string): ElementShim | null {
      if (
        selector === this.localName ||
        selector === this.tagName.toLowerCase()
      ) {
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
  defineTestGlobal('document', {
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
  } as unknown as Document)
  defineTestGlobal(
    'window',
    globalThis as unknown as Window & typeof globalThis
  )
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

function renderActionDialog(): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  const root = createRoot(container)
  React.act(() => {
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(CampaignActionDialog, {
          action: 'retry',
          campaignId: 42,
          onOpenChange: () => undefined,
          open: true,
          recipientId: 73,
          uncertain: true,
        })
      )
    )
  })
  return { container, root }
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

function findElement(
  element: Element,
  predicate: (candidate: Element) => boolean
): Element | undefined {
  if (predicate(element)) return element
  for (const child of Array.from(element.childNodes)) {
    if (child instanceof HTMLElement) {
      const match = findElement(child, predicate)
      if (match) return match
    }
  }
  return undefined
}

async function click(element: Element) {
  await React.act(async () => {
    element.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true })
    )
    await Promise.resolve()
  })
}

describe('CampaignActionDialog localization blockers', () => {
  test('extracts structured activation blockers from the API error data', () => {
    const error = new RecallApiError('Translations are stale', {
      blockers: [
        { stage_no: 2, locale: 'es', reason: 'stale' },
        { stage_no: 2, locale: 'fr', reason: 'missing' },
      ],
    })

    expect(getRecallLocalizationBlockers(error)).toEqual([
      { stage_no: 2, locale: 'es', reason: 'stale' },
      { stage_no: 2, locale: 'fr', reason: 'missing' },
    ])
  })

  test('ignores malformed error data', () => {
    expect(getRecallLocalizationBlockers(new Error('No data'))).toEqual([])
    expect(
      getRecallLocalizationBlockers(
        new RecallApiError('Bad data', { blockers: [{ locale: 'es' }] })
      )
    ).toEqual([])
  })

  test('hands an activation blocker to the repair flow without a generic error', () => {
    const events: string[] = []
    const error = new RecallApiError('Translations are stale', {
      blockers: [{ stage_no: 2, locale: 'es', reason: 'stale' }],
    })

    handleRecallCampaignActionError('activate', error, {
      onLocalizationBlocked: () => events.push('blocked'),
      onClose: () => events.push('closed'),
      onError: () => events.push('error'),
    })

    expect(events).toEqual(['blocked', 'closed'])
  })

  test('shows the activation error when no localization repair handler exists', () => {
    const events: string[] = []
    const error = new RecallApiError('Translations are stale', {
      blockers: [{ stage_no: 2, locale: 'es', reason: 'stale' }],
    })

    handleRecallCampaignActionError('activate', error, {
      onClose: () => events.push('closed'),
      onError: (message) => events.push(message),
    })

    expect(events).toEqual(['Translations are stale'])
  })

  test('uses stable Activity SMTP action error codes before raw backend messages', () => {
    const events: string[] = []
    const error = new RecallApiError('raw backend SMTP detail', {
      code: 'activity_smtp_not_configured',
      message: 'raw backend SMTP detail',
    })

    handleRecallCampaignActionError('activate', error, {
      onClose: () => events.push('closed'),
      onError: (message) => events.push(message),
    })

    expect(events).toEqual([
      'Activity SMTP is not configured. Configure it before sending.',
    ])
  })

  test('requires duplicate-risk acknowledgment before retrying an uncertain recipient', async () => {
    retryMutation.mockClear()
    const { container, root } = renderActionDialog()

    try {
      expect(container.textContent).toContain(
        'Retrying can send a duplicate email'
      )
      expect(container.textContent).toContain(
        'I acknowledge that retrying an uncertain message may send a duplicate email.'
      )
      const confirm = findElement(
        container,
        (element) =>
          element.tagName.toLowerCase() === 'button' &&
          element.textContent === 'Confirm'
      ) as HTMLButtonElement | undefined
      expect(confirm).toBeTruthy()
      expect(confirm?.disabled).toBe(true)
      await click(confirm as HTMLButtonElement)
      expect(retryMutation).not.toHaveBeenCalled()

      const checkbox = container.querySelector('input') as HTMLInputElement
      checkbox.checked = true
      await React.act(async () => {
        checkbox.dispatchEvent(
          new Event('click', { bubbles: true, cancelable: true })
        )
        checkbox.dispatchEvent(
          new Event('change', { bubbles: true, cancelable: true })
        )
        await Promise.resolve()
      })

      expect(confirm?.disabled).toBe(false)
      await click(confirm as HTMLButtonElement)

      expect(retryMutation).toHaveBeenCalledWith({
        recipientId: 73,
        acknowledgeUncertain: true,
      })
    } finally {
      dispose(root)
    }
  })
})

afterAll(() => {
  mock.restore()
  restoreTestGlobals()
})
