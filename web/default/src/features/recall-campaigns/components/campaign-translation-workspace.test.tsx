import * as React from 'react'
import { createFormControl, type UseFormReturn } from 'react-hook-form'
import { describe, expect, mock, test } from 'bun:test'
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
})
