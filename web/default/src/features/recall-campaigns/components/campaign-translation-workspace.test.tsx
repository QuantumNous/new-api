import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createFormControl, type UseFormReturn } from 'react-hook-form'
import { afterAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallCampaignDraft, RecallEmailStage } from '../types'

mock.module('./campaign-email-html-editor', () => ({
  CampaignEmailHtmlEditor: (props: {
    disabled?: boolean
    index: number
    locale: string
  }) => (
    <textarea
      data-email-editor='true'
      data-index={props.index}
      data-locale={props.locale}
      disabled={props.disabled}
    />
  ),
}))

const {
  CampaignTranslationWorkspace,
  getRecallEmailEditorKey,
  getRecallManualLocaleCount,
  getRecallTranslationSummary,
  getRecallTranslationStatusKey,
  getRecallWorkspaceLocaleStatus,
  markRecallManualLocale,
} = await import('./campaign-translation-workspace')

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

const targetLocales = ['zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'] as const

function makeStage(stageNo = 1): RecallEmailStage {
  return {
    stage_no: stageNo,
    delay_seconds: (stageNo - 1) * 86_400,
    template_version: 1,
    source_revision: 1,
    translated_source_revision: 1,
    manual_locales: [],
    templates: {
      en: { subject: `Stage ${stageNo}`, body_html: '<p>English</p>' },
      ...Object.fromEntries(
        targetLocales.map((locale) => [
          locale,
          { subject: `${locale} ${stageNo}`, body_html: `<p>${locale}</p>` },
        ])
      ),
    },
  }
}

function makeDraft(stages: RecallEmailStage[]): RecallCampaignDraft {
  return {
    name: 'Translation workspace',
    email_sequence: stages,
  } as RecallCampaignDraft
}

function createForm(
  draft: RecallCampaignDraft
): UseFormReturn<RecallCampaignDraft> {
  const form = createFormControl<RecallCampaignDraft>({ defaultValues: draft })
  form.subscribe({
    formState: { dirtyFields: true, values: true },
    callback: () => undefined,
  })
  return form as unknown as UseFormReturn<RecallCampaignDraft>
}

function renderWorkspace(
  draft: RecallCampaignDraft,
  focusBlocker?: { stage_no: number; locale: string; reason: 'missing' },
  disabled = false,
  immutable = false
): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <CampaignTranslationWorkspace
        disabled={disabled}
        immutable={immutable}
        focusBlocker={focusBlocker}
        form={createForm(draft)}
        isGenerating={false}
        onGenerate={async () => undefined}
      />
    </I18nextProvider>
  )
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
    activeElement: null,
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

function renderWorkspaceDom(
  draft: RecallCampaignDraft,
  onGenerate: () => Promise<void>
): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  const root = createRoot(container)
  React.act(() => {
    root.render(
      <I18nextProvider i18n={testI18n}>
        <CampaignTranslationWorkspace
          disabled={false}
          form={createForm(draft)}
          isGenerating={false}
          onGenerate={onGenerate}
        />
      </I18nextProvider>
    )
  })
  return { container, root }
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
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

async function rapidClickByID(container: HTMLElement, id: string) {
  const element = container.querySelector(`#${id}`)
  expect(element).toBeTruthy()
  await React.act(async () => {
    element?.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true })
    )
    element?.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true })
    )
    await Promise.resolve()
  })
}

describe('CampaignTranslationWorkspace', () => {
  test('renders separate English and Translation review tabs', () => {
    const stage = makeStage()
    stage.templates = { en: stage.templates.en }
    stage.translated_source_revision = 0

    const html = renderWorkspace(makeDraft([stage]))

    expect(html).toContain('role="tablist"')
    expect(html).toContain('English content')
    expect(html).toContain('Translation review')
    expect(html).toContain('data-locale="en"')
    expect(html).not.toContain('data-locale="es"')
  })

  test('uses one all-stage generation action', () => {
    const html = renderWorkspace(makeDraft([makeStage(1), makeStage(2)]))

    expect(html.match(/id="recall-generate-translations"/g) ?? []).toHaveLength(
      1
    )
    expect(html).toContain('Email stage 1')
    expect(html).toContain('Email stage 2')
    expect(html).toContain('Generate 7 translations')
  })

  test('disables stage delay editing with the rest of the workspace', () => {
    const html = renderWorkspace(makeDraft([makeStage()]), undefined, true)

    expect(html).toMatch(
      /<input(?=[^>]*type="number")(?=[^>]*disabled="")[^>]*>/
    )
  })

  test('keeps stage delay editable only on the English source tab', () => {
    const draft = makeDraft([makeStage()])

    const englishHtml = renderWorkspace(draft)
    expect(englishHtml).toMatch(
      /<input(?=[^>]*name="email_sequence\.0\.delay_seconds")(?![^>]*disabled="")[^>]*>/
    )

    const targetHtml = renderWorkspace(draft, {
      stage_no: 1,
      locale: 'es',
      reason: 'missing',
    })
    expect(targetHtml).toMatch(
      /<input(?=[^>]*name="email_sequence\.0\.delay_seconds")(?=[^>]*disabled="")[^>]*>/
    )
  })

  test('makes every template editing action read-only after activation', () => {
    const html = renderWorkspace(
      makeDraft([makeStage()]),
      undefined,
      false,
      true
    )

    expect(html).toMatch(
      /<input(?=[^>]*name="email_sequence\.0\.templates\.en\.subject")(?=[^>]*disabled="")[^>]*>/
    )
    expect(html).toMatch(
      /<textarea(?=[^>]*data-email-editor="true")(?=[^>]*disabled="")[^>]*>/
    )
    expect(html).toMatch(
      /<button(?=[^>]*id="recall-generate-translations")(?=[^>]*disabled="")[^>]*>/
    )
  })

  test('disables adding and removing stages with the rest of the workspace', () => {
    const html = renderWorkspace(
      makeDraft([makeStage(1), makeStage(2)]),
      undefined,
      true
    )

    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>Remove stage<\/button>/
    )
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>Add email stage<\/button>/
    )
  })

  test('summarizes optional locale review without acknowledgments', () => {
    const html = renderWorkspace(makeDraft([makeStage()]), {
      stage_no: 1,
      locale: 'es',
      reason: 'missing',
    })

    expect(html).toContain('7 / 7 ready')
    expect(html).toContain('English context')
    expect(html).toContain('data-locale="es"')
    expect(html).not.toContain('type="checkbox"')
  })

  test('derives stale state immediately after an English edit', () => {
    const stage = makeStage()

    expect(getRecallWorkspaceLocaleStatus(stage, 'es', false)).toBe('ready')
    expect(getRecallWorkspaceLocaleStatus(stage, 'es', true)).toBe('stale')
  })

  test('isolates translation status labels from execution mode labels', () => {
    expect(getRecallTranslationStatusKey('manual')).toBe(
      'recall.translation_status.manual'
    )
    expect(getRecallTranslationStatusKey('ready')).toBe(
      'recall.translation_status.ready'
    )
  })

  test('counts ready targets across every stage', () => {
    const first = makeStage(1)
    const second = makeStage(2)
    delete second.templates.vi

    expect(getRecallTranslationSummary([first, second], new Set())).toEqual({
      ready: 13,
      total: 14,
    })
  })

  test('marks only the manually edited locale', () => {
    const form = createForm(makeDraft([makeStage()]))

    markRecallManualLocale(form, 0, 'es')

    expect(form.getValues('email_sequence.0.manual_locales')).toEqual(['es'])
  })

  test('counts only supported target languages as manual translations', () => {
    const stage = makeStage()
    stage.manual_locales = ['en', 'es', 'es', 'de']

    expect(getRecallManualLocaleCount([stage])).toBe(1)
  })

  test('uses a distinct editor identity for every locale in a stage', () => {
    expect(getRecallEmailEditorKey('stage-1', 'en')).toBe('stage-1-en')
    expect(getRecallEmailEditorKey('stage-1', 'es')).toBe('stage-1-es')
    expect(getRecallEmailEditorKey('stage-1', 'en')).not.toBe(
      getRecallEmailEditorKey('stage-1', 'es')
    )
  })

  test('suppresses rapid generate clicks until the async generation finishes', async () => {
    let resolveGeneration: (() => void) | undefined
    const onGenerate = mock(
      () =>
        new Promise<void>((resolve) => {
          resolveGeneration = resolve
        })
    )
    const { container, root } = renderWorkspaceDom(
      makeDraft([makeStage()]),
      onGenerate
    )

    await rapidClickByID(container, 'recall-generate-translations')

    expect(onGenerate).toHaveBeenCalledTimes(1)
    let button = container.querySelector(
      '#recall-generate-translations'
    ) as HTMLButtonElement | null
    expect(button?.disabled).toBe(true)
    expect(container.textContent).toContain('Generating translations')

    resolveGeneration?.()
    await React.act(async () => {
      await Promise.resolve()
    })
    button = container.querySelector(
      '#recall-generate-translations'
    ) as HTMLButtonElement | null
    expect(button?.disabled).toBe(false)
    dispose(root)
  })

  test('suppresses rapid confirmed regeneration clicks', async () => {
    let resolveGeneration: (() => void) | undefined
    const onGenerate = mock(
      () =>
        new Promise<void>((resolve) => {
          resolveGeneration = resolve
        })
    )
    const stage = makeStage()
    stage.manual_locales = ['es']
    const { container, root } = renderWorkspaceDom(makeDraft([stage]), onGenerate)

    await clickByID(container, 'recall-generate-translations')
    expect(container.textContent).toContain(
      'Regenerating will replace 1 manually edited translations.'
    )
    await rapidClickByID(container, 'recall-confirm-regenerate-translations')

    expect(onGenerate).toHaveBeenCalledTimes(1)
    const button = container.querySelector(
      '#recall-confirm-regenerate-translations'
    ) as HTMLButtonElement | null
    expect(button?.disabled).toBe(true)

    resolveGeneration?.()
    await React.act(async () => {
      await Promise.resolve()
    })
    dispose(root)
  })
})

afterAll(() => {
  restoreTestGlobals()
})
