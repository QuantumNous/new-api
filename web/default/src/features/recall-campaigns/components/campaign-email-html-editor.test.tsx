import { useForm } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { recallCampaignDraftSchema } from '../schemas'
import type { RecallCampaignDraft } from '../types'
import {
  CampaignEmailHtmlEditor,
  RecallEmailPreviewFrame,
  clearRecallEmailPreviewError,
  createRecallEmailPreviewTemplate,
  prepareRecallEmailPreviewRequest,
  shouldApplyRecallEmailPreviewResult,
} from './campaign-email-html-editor'

const testI18n = createInstance()

function makeDraft(): RecallCampaignDraft {
  return {
    name: 'Test campaign',
    audience_template: 'first_purchase',
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
    product_scope: { topup_price_ids: ['price_topup'] },
    promotion_valid_seconds: 604800,
    enrollment_limit: 1000,
    worker_concurrency: 5,
    email_sequence: [
      {
        stage_no: 1,
        delay_seconds: 0,
        template_version: 1,
        templates: {
          en: {
            subject: 'English subject',
            body_text: '',
            body_html: '<p>Hello {{.RecipientName}}</p>',
          },
        },
      },
    ],
  }
}

function renderEditor(disabled = false, draft = makeDraft()): string {
  function Harness() {
    const form = useForm<RecallCampaignDraft>({
      defaultValues: draft,
      resolver: async (values) => {
        const result = recallCampaignDraftSchema.safeParse(values)
        return result.success
          ? { values: result.data, errors: {} }
          : { values: {}, errors: {} }
      },
    })

    return <CampaignEmailHtmlEditor form={form} index={0} disabled={disabled} />
  }

  const queryClient = new QueryClient()
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <Harness />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function getElement(html: string, pattern: RegExp): string {
  const element = html.match(pattern)?.[0]
  expect(element).toBeTruthy()
  return element ?? ''
}

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('recall email preview race guard', () => {
  const latest = {
    requestId: 2,
    subject: 'Current subject',
    bodyHTML: '<p>Current body</p>',
  }

  test('ignores stale success and stale error when current values changed', () => {
    expect(
      shouldApplyRecallEmailPreviewResult({
        candidate: latest,
        latest,
        currentSubject: 'Edited subject',
        currentBodyHTML: latest.bodyHTML,
      })
    ).toBe(false)
    expect(
      shouldApplyRecallEmailPreviewResult({
        candidate: latest,
        latest,
        currentSubject: latest.subject,
        currentBodyHTML: '<p>Edited body</p>',
      })
    ).toBe(false)
  })

  test('ignores rapid out-of-order A when B is the latest request', () => {
    expect(
      shouldApplyRecallEmailPreviewResult({
        candidate: {
          requestId: 1,
          subject: 'Older subject',
          bodyHTML: '<p>Older body</p>',
        },
        latest,
        currentSubject: latest.subject,
        currentBodyHTML: latest.bodyHTML,
      })
    ).toBe(false)
  })

  test('accepts unchanged latest success and error results', () => {
    expect(
      shouldApplyRecallEmailPreviewResult({
        candidate: latest,
        latest,
        currentSubject: latest.subject,
        currentBodyHTML: latest.bodyHTML,
      })
    ).toBe(true)
  })

  test('clears backend errors for local validation without removing last preview', () => {
    expect(
      clearRecallEmailPreviewError({
        previewHTML: '<p>Last successful preview</p>',
        latestError: 'Previous backend error',
      })
    ).toEqual({
      previewHTML: '<p>Last successful preview</p>',
      latestError: '',
    })
  })

  test('builds preview templates with converted body HTML and a fallback subject', () => {
    const plainPreview = createRecallEmailPreviewTemplate({
      subject: '',
      bodyHTML: 'Plain preview\n2 < 3',
    })

    expect(plainPreview.subject).toBe('Recall email preview')
    expect(plainPreview.body_html).toContain('<p>Plain preview</p>')
    expect(plainPreview.body_html).toContain('<p>2 &lt; 3</p>')

    const source =
      '<p>Hello</p><p><a href="{{.ClaimURL}}">Claim</a></p><p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></p>'
    expect(
      createRecallEmailPreviewTemplate({
        subject: 'Actual subject',
        bodyHTML: source,
      })
    ).toEqual({ subject: 'Actual subject', body_html: source })
  })

  test('prepares a plain-text preview without replacing the operator input', async () => {
    const operatorBody = 'Plain preview\n2 < 3'
    const prepared = await prepareRecallEmailPreviewRequest({
      nextRequestId: () => 3,
      subject: '',
      bodyHTML: operatorBody,
      validateBody: async () => true,
    })

    expect(prepared?.snapshot).toEqual({
      requestId: 3,
      subject: '',
      bodyHTML: operatorBody,
    })
    expect(prepared?.template.subject).toBe('Recall email preview')
    expect(prepared?.template.body_html).toContain('<p>Plain preview</p>')
    expect(prepared?.template.body_html).toContain('<p>2 &lt; 3</p>')
    expect(operatorBody).toBe('Plain preview\n2 < 3')
  })

  test('assigns the preview request id only after body validation completes', async () => {
    let resolveValidation: ((valid: boolean) => void) | undefined
    let nextRequestId = 0
    const preparing = prepareRecallEmailPreviewRequest({
      nextRequestId: () => (nextRequestId += 1),
      subject: 'Subject',
      bodyHTML: '<p>Body</p>',
      validateBody: () =>
        new Promise<boolean>((resolve) => {
          resolveValidation = resolve
        }),
    })

    expect(nextRequestId).toBe(0)
    resolveValidation?.(true)
    const prepared = await preparing

    expect(prepared?.snapshot.requestId).toBe(1)
    expect(nextRequestId).toBe(1)
  })
})

describe('CampaignEmailHtmlEditor', () => {
  test('registers the English HTML body and omits the legacy text body control', () => {
    const html = renderEditor()

    expect(html).toContain('name="email_sequence.0.templates.en.body_html"')
    expect(html).not.toContain('name="email_sequence.0.templates.en.body_text"')
    expect(html).toContain('&lt;p&gt;Hello {{.RecipientName}}&lt;/p&gt;')
  })

  test('labels the editor field as body text for operators', () => {
    const html = renderEditor()

    expect(html).toContain('>Body text</label>')
    expect(html).not.toContain('>Body HTML</label>')
  })

  test('renders all insertion buttons with accessible action labels', () => {
    const html = renderEditor()

    for (const action of [
      '{{.RecipientName}}',
      '{{.PromotionCodeMasked}}',
      '{{.ProductSummary}}',
      '{{.ExpiresAt}}',
      '{{.ClaimURL}}',
      '{{.UnsubscribeURL}}',
    ]) {
      expect(html).toContain(`aria-label="Insert ${action}"`)
      expect(html).toContain('type="button"')
    }
  })

  test('disables textarea and preview button for terminal campaigns', () => {
    const html = renderEditor(true)
    const textarea = getElement(
      html,
      /<textarea[^>]*name="email_sequence\.0\.templates\.en\.body_html"[^>]*>/
    )
    const previewButton = getElement(
      html,
      /<button[^>]*aria-label="Recall email preview"[^>]*>/
    )

    expect(textarea).toContain('disabled=""')
    expect(previewButton).toContain('disabled=""')
  })

  test('renders the exact-one body HTML error on the active editor field', () => {
    const draft = makeDraft()
    draft.email_sequence[0].templates.en.body_html = ''
    const html = renderEditor(false, draft)
    const textarea = getElement(
      html,
      /<textarea[^>]*name="email_sequence\.0\.templates\.en\.body_html"[^>]*>/
    )

    expect(textarea).toContain('aria-invalid="true"')
    expect(textarea).toContain(
      'aria-describedby="recall-email-0-body-html-error"'
    )
    expect(html).toContain('Exactly one email body is required')
  })
})

describe('RecallEmailPreviewFrame', () => {
  test('renders successful preview HTML only through a no-permission sandbox iframe', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <RecallEmailPreviewFrame
          previewHTML='<script>alert(1)</script><p>Preview</p>'
          errorMessage=''
        />
      </I18nextProvider>
    )
    const iframe = getElement(html, /<iframe[^>]*>/)

    expect(iframe).toContain('title="Recall email preview"')
    expect(iframe).toContain(
      'srcDoc="&lt;script&gt;alert(1)&lt;/script&gt;&lt;p&gt;Preview&lt;/p&gt;"'
    )
    expect(iframe).toMatch(/\ssandbox(=""|(?=[\s>]))/)
    expect(iframe).not.toContain('allow-scripts')
    expect(iframe).not.toContain('allow-same-origin')
    expect(iframe).not.toContain('allow-popups')
    expect(iframe).not.toContain('allow-top-navigation')
    expect(html).not.toContain('dangerouslySetInnerHTML')
  })

  test('shows a localized error without removing the last successful preview', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <RecallEmailPreviewFrame
          previewHTML='<p>Last good preview</p>'
          errorMessage='Preview failed'
        />
      </I18nextProvider>
    )

    expect(html).toContain('Preview failed')
    expect(html).toContain('&lt;p&gt;Last good preview&lt;/p&gt;')
    expect(html).not.toContain('<p>Last good preview</p>')
  })
})
