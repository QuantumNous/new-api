import { useRef, useState } from 'react'
import type { FieldPath, UseFormReturn } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { previewRecallEmail } from '../api'
import {
  insertRecallEmailAction,
  normalizeRecallBodyInputToHtml,
  RECALL_EMAIL_ACTION_DESCRIPTIONS,
  RECALL_EMAIL_ACTIONS,
} from '../helpers'
import type { RecallCampaignDraft } from '../types'

interface CampaignEmailHtmlEditorProps {
  form: UseFormReturn<RecallCampaignDraft>
  index: number
  disabled: boolean
}

interface RecallEmailPreviewFrameProps {
  previewHTML: string
  errorMessage: string
}

interface RecallEmailPreviewSnapshot {
  requestId: number
  subject: string
  bodyHTML: string
}

interface RecallEmailPreviewState {
  previewHTML: string
  latestError: string
}

interface RecallEmailPreviewPreparedRequest {
  snapshot: RecallEmailPreviewSnapshot
  template: { subject: string; body_html: string }
}

// eslint-disable-next-line react-refresh/only-export-components
export function createRecallEmailPreviewTemplate(props: {
  subject: string
  bodyHTML: string
}): { subject: string; body_html: string } {
  return {
    subject: props.subject.trim() || 'Recall email preview',
    body_html: normalizeRecallBodyInputToHtml(props.bodyHTML),
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function prepareRecallEmailPreviewRequest(props: {
  nextRequestId: () => number
  subject: string
  bodyHTML: string
  validateBody: () => Promise<boolean>
}): Promise<RecallEmailPreviewPreparedRequest | null> {
  if (!(await props.validateBody())) return null

  const snapshot = {
    requestId: props.nextRequestId(),
    subject: props.subject,
    bodyHTML: props.bodyHTML,
  }
  return {
    snapshot,
    template: createRecallEmailPreviewTemplate(snapshot),
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function shouldApplyRecallEmailPreviewResult(props: {
  candidate: RecallEmailPreviewSnapshot
  latest: RecallEmailPreviewSnapshot | null
  currentSubject: string
  currentBodyHTML: string
}): boolean {
  return (
    props.latest !== null &&
    props.candidate.requestId === props.latest.requestId &&
    props.candidate.subject === props.latest.subject &&
    props.candidate.bodyHTML === props.latest.bodyHTML &&
    props.currentSubject === props.candidate.subject &&
    props.currentBodyHTML === props.candidate.bodyHTML
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function clearRecallEmailPreviewError(
  state: RecallEmailPreviewState
): RecallEmailPreviewState {
  return { ...state, latestError: '' }
}

function getRecallEditorErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Recall email preview failed'
}

export function RecallEmailPreviewFrame(
  props: RecallEmailPreviewFrameProps
): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className='space-y-2'>
      {props.errorMessage ? (
        <p role='alert' className='text-destructive text-sm'>
          {t(props.errorMessage)}
        </p>
      ) : null}
      {props.previewHTML ? (
        <iframe
          title={t('Recall email preview')}
          sandbox=''
          srcDoc={props.previewHTML}
          className='h-[640px] w-full rounded-md border bg-white'
        />
      ) : null}
    </div>
  )
}

export function CampaignEmailHtmlEditor(
  props: CampaignEmailHtmlEditorProps
): React.JSX.Element {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRequestIdRef = useRef(0)
  const latestPreviewRequestRef = useRef<RecallEmailPreviewSnapshot | null>(
    null
  )
  const [previewState, setPreviewState] = useState<RecallEmailPreviewState>({
    previewHTML: '',
    latestError: '',
  })
  const subjectPath =
    `email_sequence.${props.index}.templates.en.subject` as FieldPath<RecallCampaignDraft>
  const bodyPath =
    `email_sequence.${props.index}.templates.en.body_html` as FieldPath<RecallCampaignDraft>
  const legacyBodyPath =
    `email_sequence.${props.index}.templates.en.body_text` as FieldPath<RecallCampaignDraft>
  const bodyId = `recall-email-${props.index}-body-html`
  const bodyErrorId = `${bodyId}-error`
  const bodyRegistration = props.form.register(bodyPath)
  const bodyError = props.form.getFieldState(
    bodyPath,
    props.form.formState
  ).error
  const bodyHTML = String(props.form.getValues(bodyPath) ?? '')
  const bodyText = String(props.form.getValues(legacyBodyPath) ?? '')
  const localBodyError =
    !bodyHTML.trim() && !bodyText.trim()
      ? 'Exactly one email body is required'
      : ''
  const activeBodyError = bodyError?.message
    ? String(bodyError.message)
    : localBodyError
  const previewMutation = useMutation({ mutationFn: previewRecallEmail })

  const insertAction = (action: (typeof RECALL_EMAIL_ACTIONS)[number]) => {
    const textarea = textareaRef.current
    const currentValue = String(props.form.getValues(bodyPath) ?? '')
    const start = textarea?.selectionStart ?? currentValue.length
    const end = textarea?.selectionEnd ?? start
    const inserted = insertRecallEmailAction(currentValue, start, end, action)
    props.form.setValue(bodyPath, inserted.value, {
      shouldDirty: true,
      shouldValidate: true,
    })
    const restoreSelection = () => {
      textarea?.focus()
      textarea?.setSelectionRange(inserted.selection, inserted.selection)
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(restoreSelection)
    } else {
      restoreSelection()
    }
  }

  const previewEmail = async () => {
    setPreviewState(clearRecallEmailPreviewError)
    const prepared = await prepareRecallEmailPreviewRequest({
      nextRequestId: () => (previewRequestIdRef.current += 1),
      subject: String(props.form.getValues(subjectPath) ?? ''),
      bodyHTML: String(props.form.getValues(bodyPath) ?? ''),
      validateBody: () => props.form.trigger(bodyPath),
    })
    if (!prepared) return
    const snapshot = prepared.snapshot
    latestPreviewRequestRef.current = snapshot
    try {
      const response = await previewMutation.mutateAsync({
        template: prepared.template,
      })
      if (
        shouldApplyRecallEmailPreviewResult({
          candidate: snapshot,
          latest: latestPreviewRequestRef.current,
          currentSubject: String(props.form.getValues(subjectPath) ?? ''),
          currentBodyHTML: String(props.form.getValues(bodyPath) ?? ''),
        })
      ) {
        setPreviewState({
          previewHTML: response.data?.body_html ?? '',
          latestError: '',
        })
      }
    } catch (error) {
      if (
        shouldApplyRecallEmailPreviewResult({
          candidate: snapshot,
          latest: latestPreviewRequestRef.current,
          currentSubject: String(props.form.getValues(subjectPath) ?? ''),
          currentBodyHTML: String(props.form.getValues(bodyPath) ?? ''),
        })
      ) {
        setPreviewState((current) => ({
          ...current,
          latestError: getRecallEditorErrorMessage(error),
        }))
      }
    }
  }

  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        <Label htmlFor={bodyId}>{t('Body text')}</Label>
        <Textarea
          id={bodyId}
          rows={14}
          disabled={props.disabled}
          aria-invalid={Boolean(activeBodyError)}
          aria-describedby={activeBodyError ? bodyErrorId : undefined}
          {...bodyRegistration}
          defaultValue={bodyHTML}
          ref={(element) => {
            bodyRegistration.ref(element)
            textareaRef.current = element
          }}
        />
        {activeBodyError ? (
          <p id={bodyErrorId} role='alert' className='text-destructive text-sm'>
            {t(activeBodyError)}
          </p>
        ) : null}
      </div>
      <div className='space-y-2'>
        <div>
          <p className='text-sm font-medium'>{t('Available placeholders')}</p>
          <p className='text-muted-foreground text-sm'>
            {t('Click a placeholder to insert it into the body.')}
          </p>
        </div>
        <div className='grid gap-2 md:grid-cols-2'>
          {RECALL_EMAIL_ACTIONS.map((action) => (
            <Button
              aria-label={t('Insert {{action}}', { action })}
              className='h-auto w-full justify-start px-3 py-2 text-left whitespace-normal'
              disabled={props.disabled}
              key={action}
              type='button'
              variant='outline'
              onClick={() => insertAction(action)}
            >
              <span className='grid gap-1'>
                <code className='text-xs'>{action}</code>
                <span className='text-muted-foreground text-xs font-normal'>
                  {t(RECALL_EMAIL_ACTION_DESCRIPTIONS[action])}
                </span>
                {action === '{{.ClaimURL}}' ||
                action === '{{.UnsubscribeURL}}' ? (
                  <span className='text-muted-foreground text-xs font-normal'>
                    {t('HTML link example:')}{' '}
                    <code>{`<a href="${action}">`}</code>
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
        <p className='text-muted-foreground text-xs'>
          {t('Preview uses sample recipient and offer data.')}
        </p>
      </div>
      <Button
        aria-label={t('Recall email preview')}
        disabled={props.disabled || previewMutation.isPending}
        type='button'
        variant='outline'
        onClick={() => void previewEmail()}
      >
        {previewMutation.isPending ? t('Previewing') : t('Preview email')}
      </Button>
      <RecallEmailPreviewFrame
        previewHTML={previewState.previewHTML}
        errorMessage={previewState.latestError}
      />
    </div>
  )
}
