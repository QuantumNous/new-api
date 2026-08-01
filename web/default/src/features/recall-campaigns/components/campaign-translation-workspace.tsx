import { useEffect, useRef, useState } from 'react'
import {
  useFieldArray,
  useFormState,
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import type { InterfaceLanguageCode } from '@/i18n/languages'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  getRecallEmailLocaleStatus,
  RECALL_EMAIL_STARTER_HTML,
  removeRecallEmailStage,
} from '../helpers'
import {
  isRecallTranslationTaskActive,
  type RecallCampaignDraft,
  type RecallEmailLocalizationBlocker,
  type RecallEmailLocaleStatus,
  type RecallEmailStage,
  type RecallTranslationTask,
} from '../types'
import { CampaignEmailHtmlEditor } from './campaign-email-html-editor'

const targetLocales = ['zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'] as const
type RecallTargetLocale = (typeof targetLocales)[number]

interface CampaignTranslationWorkspaceProps {
  form: UseFormReturn<RecallCampaignDraft>
  disabled: boolean
  immutable?: boolean
  isGenerating: boolean
  onGenerate: () => Promise<void>
  onApplyServerRefresh?: () => void
  serverRefreshPending?: boolean
  focusBlocker?: RecallEmailLocalizationBlocker
  translationTask?: RecallTranslationTask
}

function isRecallTargetLocale(locale: string): locale is RecallTargetLocale {
  return targetLocales.includes(locale as RecallTargetLocale)
}

function isEnglishStageDirty(
  dirtyFields: ReturnType<
    typeof useFormState<RecallCampaignDraft>
  >['dirtyFields'],
  index: number
): boolean {
  const stage = dirtyFields.email_sequence?.[index]
  return Boolean(stage?.templates?.en)
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallWorkspaceLocaleStatus(
  stage: RecallEmailStage,
  locale: string,
  englishDirty: boolean
): RecallEmailLocaleStatus {
  const persistedStatus = getRecallEmailLocaleStatus(stage, locale)
  if (persistedStatus === 'missing' || locale === 'en') return persistedStatus
  return englishDirty ? 'stale' : persistedStatus
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallTranslationStatusKey(
  status: RecallEmailLocaleStatus
): string {
  return `recall.translation_status.${status}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallTranslationSummary(
  stages: RecallEmailStage[],
  englishDirtyStages: Set<number>
): { ready: number; total: number } {
  let ready = 0
  for (const [index, stage] of stages.entries()) {
    for (const locale of targetLocales) {
      const status = getRecallWorkspaceLocaleStatus(
        stage,
        locale,
        englishDirtyStages.has(index)
      )
      if (status === 'ready' || status === 'manual') ready += 1
    }
  }
  return { ready, total: stages.length * targetLocales.length }
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallManualLocaleCount(stages: RecallEmailStage[]): number {
  return stages.reduce(
    (count, stage) =>
      count +
      new Set(
        (stage.manual_locales ?? []).filter((locale) =>
          isRecallTargetLocale(locale)
        )
      ).size,
    0
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallEmailEditorKey(
  stageID: string,
  locale: string
): string {
  return `${stageID}-${locale}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function markRecallManualLocale(
  form: UseFormReturn<RecallCampaignDraft>,
  stageIndex: number,
  locale: string
): void {
  if (!isRecallTargetLocale(locale)) return
  const path =
    `email_sequence.${stageIndex}.manual_locales` as FieldPath<RecallCampaignDraft>
  const manualLocales = new Set(
    form.getValues(path) as RecallEmailStage['manual_locales']
  )
  manualLocales.add(locale)
  form.setValue(path, [...manualLocales], {
    shouldDirty: true,
    shouldValidate: true,
  })
}

function getGenerationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Translation generation failed'
}

function getTranslationTaskError(task: RecallTranslationTask): string {
  return task.error_copy_key?.trim() || task.error_code?.trim() || ''
}

export function CampaignTranslationWorkspace(
  props: CampaignTranslationWorkspaceProps
): React.JSX.Element {
  const { t } = useTranslation()
  const blockerLocale = props.focusBlocker?.locale ?? ''
  const existingTargetLocale = targetLocales.find((locale) =>
    props.form
      .getValues('email_sequence')
      .some((stage) => Boolean((stage.templates ?? {})[locale]))
  )
  const initialTargetLocale = isRecallTargetLocale(blockerLocale)
    ? blockerLocale
    : (existingTargetLocale ?? targetLocales[0])
  const [activeTab, setActiveTab] = useState<'english' | 'translations'>(() =>
    props.focusBlocker ? 'translations' : 'english'
  )
  const [activeTargetLocale, setActiveTargetLocale] =
    useState<RecallTargetLocale>(initialTargetLocale)
  const [confirmRegeneration, setConfirmRegeneration] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationInFlight, setGenerationInFlight] = useState(false)
  const generationInFlightRef = useRef(false)
  const subjectRefs = useRef(new Map<string, HTMLInputElement>())
  const formState = useFormState({ control: props.form.control })
  const watchedStages =
    useWatch({ control: props.form.control, name: 'email_sequence' }) ?? []
  const campaignType =
    useWatch({ control: props.form.control, name: 'campaign_type' }) ??
    'promotion'
  const stages = useFieldArray({
    control: props.form.control,
    name: 'email_sequence',
  })
  const englishDirtyStages = new Set<number>()
  for (let index = 0; index < watchedStages.length; index += 1) {
    if (isEnglishStageDirty(formState.dirtyFields, index)) {
      englishDirtyStages.add(index)
    }
  }
  const summary = getRecallTranslationSummary(watchedStages, englishDirtyStages)
  const manualCount = getRecallManualLocaleCount(watchedStages)
  const readOnly = props.disabled || Boolean(props.immutable)
  const activeTranslationTask = props.translationTask
    ? isRecallTranslationTaskActive(props.translationTask.status)
    : false
  const generationPending =
    props.isGenerating || generationInFlight || activeTranslationTask

  useEffect(() => {
    if (!props.focusBlocker) return
    // A new activation blocker is an imperative request to reveal its field.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('translations')
    if (isRecallTargetLocale(props.focusBlocker.locale)) {
      setActiveTargetLocale(props.focusBlocker.locale)
    }
  }, [props.focusBlocker])

  useEffect(() => {
    if (!props.focusBlocker || activeTab !== 'translations') return
    const key = `${props.focusBlocker.stage_no - 1}-${props.focusBlocker.locale}`
    subjectRefs.current.get(key)?.focus()
  }, [activeTab, activeTargetLocale, props.focusBlocker])

  const generate = async () => {
    if (generationInFlightRef.current) return
    generationInFlightRef.current = true
    setGenerationInFlight(true)
    setGenerationError('')
    try {
      await props.onGenerate()
      setConfirmRegeneration(false)
    } catch (error) {
      setGenerationError(getGenerationErrorMessage(error))
    } finally {
      generationInFlightRef.current = false
      setGenerationInFlight(false)
    }
  }

  const requestGeneration = () => {
    if (manualCount > 0) {
      setConfirmRegeneration(true)
      return
    }
    void generate()
  }

  const renderStageEditor = (
    stage: (typeof stages.fields)[number],
    index: number,
    locale: InterfaceLanguageCode
  ) => {
    const subjectPath =
      `email_sequence.${index}.templates.${locale}.subject` as FieldPath<RecallCampaignDraft>
    const subjectId = `recall-email-${index}-${locale}-subject`
    const subjectErrorId = `${subjectId}-error`
    const subjectHelpId = `${subjectId}-help`
    const subjectError = props.form.getFieldState(
      subjectPath,
      props.form.formState
    ).error
    const subjectRegistration = props.form.register(subjectPath)
    const targetLocale = locale !== 'en'

    return (
      <div
        className='space-y-3 rounded-lg border p-3'
        key={getRecallEmailEditorKey(stage.id, locale)}
      >
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <strong>{t('Email stage {{stage}}', { stage: index + 1 })}</strong>
          <span className='text-muted-foreground text-xs'>
            {t('TemplateVersion')}:{' '}
            {props.form.watch(`email_sequence.${index}.template_version`)}
          </span>
        </div>
        {targetLocale ? (
          <div className='bg-muted rounded-md p-3 text-sm'>
            <p className='font-medium'>{t('English context')}</p>
            <p className='text-muted-foreground'>
              {watchedStages[index]?.templates?.en?.subject ?? ''}
            </p>
          </div>
        ) : null}
        <div className='grid gap-3 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label>
              {index === 0
                ? t('Delay seconds')
                : t('Absolute offset from the first SMTP accepted email.')}
            </Label>
            <Input
              type='number'
              min={0}
              disabled={readOnly || targetLocale}
              {...props.form.register(`email_sequence.${index}.delay_seconds`, {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor={subjectId}>{t('Subject')}</Label>
            <Input
              id={subjectId}
              disabled={readOnly}
              aria-invalid={Boolean(subjectError)}
              aria-describedby={`${subjectHelpId}${subjectError ? ` ${subjectErrorId}` : ''}`}
              {...subjectRegistration}
              onChange={(event) => {
                void subjectRegistration.onChange(event)
                if (targetLocale) {
                  markRecallManualLocale(props.form, index, locale)
                }
              }}
              ref={(element) => {
                subjectRegistration.ref(element)
                const key = `${index}-${locale}`
                if (element) subjectRefs.current.set(key, element)
                else subjectRefs.current.delete(key)
              }}
            />
            <p id={subjectHelpId} className='text-muted-foreground text-sm'>
              {t('Leave empty to use the campaign name.')}
            </p>
            {subjectError ? (
              <p
                id={subjectErrorId}
                role='alert'
                className='text-destructive text-sm'
              >
                {t(String(subjectError.message))}
              </p>
            ) : null}
          </div>
        </div>
        <CampaignEmailHtmlEditor
          form={props.form}
          index={index}
          locale={locale}
          disabled={readOnly}
          onEdit={
            targetLocale
              ? () => markRecallManualLocale(props.form, index, locale)
              : undefined
          }
        />
        {stages.fields.length > 1 && !props.immutable ? (
          <Button
            type='button'
            variant='outline'
            disabled={readOnly}
            onClick={() =>
              stages.replace(
                removeRecallEmailStage(
                  props.form.getValues('email_sequence'),
                  index
                )
              )
            }
          >
            {t('Remove stage')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2' role='tablist'>
        <Button
          id='recall-email-tab-english'
          role='tab'
          type='button'
          variant={activeTab === 'english' ? 'default' : 'outline'}
          aria-selected={activeTab === 'english'}
          onClick={() => setActiveTab('english')}
        >
          {t('English content')}
        </Button>
        <Button
          id='recall-email-tab-translations'
          role='tab'
          type='button'
          variant={activeTab === 'translations' ? 'default' : 'outline'}
          aria-selected={activeTab === 'translations'}
          onClick={() => setActiveTab('translations')}
        >
          {t('Translation review')}
        </Button>
      </div>

      {activeTab === 'english' ? (
        <div className='space-y-4'>
          {stages.fields.map((stage, index) =>
            renderStageEditor(stage, index, 'en')
          )}
        </div>
      ) : (
        <div className='space-y-4'>
          <div className='flex flex-wrap gap-2' aria-label={t('Language')}>
            {targetLocales.map((locale) => (
              <Button
                key={locale}
                type='button'
                size='sm'
                variant={activeTargetLocale === locale ? 'default' : 'outline'}
                aria-pressed={activeTargetLocale === locale}
                onClick={() => setActiveTargetLocale(locale)}
              >
                <span>{locale.toUpperCase()}</span>
                <span className='text-xs'>
                  {watchedStages
                    .map((stage, index) =>
                      t(
                        getRecallTranslationStatusKey(
                          getRecallWorkspaceLocaleStatus(
                            stage,
                            locale,
                            englishDirtyStages.has(index)
                          )
                        )
                      )
                    )
                    .join(', ')}
                </span>
              </Button>
            ))}
          </div>
          <div className='space-y-4'>
            {stages.fields.map((stage, index) =>
              renderStageEditor(stage, index, activeTargetLocale)
            )}
          </div>
        </div>
      )}

      {confirmRegeneration ? (
        <div role='alert' className='space-y-2 rounded-md border p-3'>
          <p>
            {t(
              'Regenerating will replace {{count}} manually edited translations.',
              { count: manualCount }
            )}
          </p>
          <Button
            id='recall-confirm-regenerate-translations'
            type='button'
            disabled={readOnly || generationPending}
            onClick={() => void generate()}
          >
            {t('Replace and regenerate')}
          </Button>
        </div>
      ) : null}
      {generationError ? (
        <p role='alert' className='text-destructive text-sm'>
          {t(generationError)}
        </p>
      ) : null}
      {props.translationTask ? (
        <div role='status' className='space-y-1 rounded-md border p-3 text-sm'>
          <p>
            {t('Translation task {{status}}', {
              status: props.translationTask.status,
            })}
          </p>
          {getTranslationTaskError(props.translationTask) ? (
            <p className='text-destructive'>
              {t(getTranslationTaskError(props.translationTask))}
            </p>
          ) : null}
        </div>
      ) : null}
      {props.serverRefreshPending ? (
        <div role='status' className='space-y-2 rounded-md border p-3 text-sm'>
          <p>{t('New campaign data is available.')}</p>
          <Button type='button' onClick={props.onApplyServerRefresh}>
            {t('Refresh campaign data')}
          </Button>
        </div>
      ) : null}
      <p className='font-medium'>{t('{{ready}} / {{total}} ready', summary)}</p>
      <Button
        id='recall-generate-translations'
        type='button'
        disabled={readOnly || generationPending}
        onClick={requestGeneration}
      >
        {generationPending
          ? t('Generating translations')
          : t('Generate 7 translations')}
      </Button>

      {stages.fields.length < 3 && !props.immutable ? (
        <Button
          type='button'
          variant='outline'
          disabled={readOnly}
          onClick={() =>
            stages.append({
              stage_no: stages.fields.length + 1,
              delay_seconds: stages.fields.length * 86_400,
              template_version: 1,
              templates: {
                en: {
                  subject: '',
                  body_text: '',
                  body_html:
                    campaignType === 'content_only'
                      ? RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML
                      : RECALL_EMAIL_STARTER_HTML,
                },
              },
            })
          }
        >
          {t('Add email stage')}
        </Button>
      ) : null}
    </div>
  )
}
