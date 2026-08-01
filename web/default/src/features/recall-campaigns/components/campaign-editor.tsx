import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { Controller, useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getLatestRecallEmailTranslationTask,
  getRecallEmailTranslationTask,
  recallCampaignKeys,
  useRecallCampaignMutations,
} from '../api'
import {
  recallLocalDateTimeToUnix,
  recallUnixToLocalDateTime,
} from '../audience-inputs'
import { audienceTemplateDescriptionKeys } from '../copy'
import {
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  RECALL_EMAIL_STARTER_HTML,
  formatRecallMinorAmount,
  normalizeRecallCouponSource,
  normalizeRecallDiscountType,
  parseRecallMajorAmount,
  prepareRecallCampaignSubmitDraft,
  recallFixedCurrencies,
  setRecallCampaignGroups,
  setRecallCampaignGroupMode,
} from '../helpers'
import {
  recallCampaignActivatedUpdateSchema,
  recallCampaignDraftSchema,
} from '../schemas'
import {
  isRecallTranslationTaskActive,
  isRecallTranslationTaskTerminal,
  type RecallCampaignDraft,
  type RecallCampaignStatus,
  type RecallDiscountConfig,
  type RecallEmailLocalizationBlocker,
  type RecallEmailTemplate,
  type RecallFixedCurrency,
  type RecallTranslationTask,
} from '../types'
import { CampaignGroupSelector } from './campaign-group-selector'
import { CampaignOfferValidityFields } from './campaign-offer-validity-fields'
import { CampaignProductSelector } from './campaign-product-selector'
import { CampaignTranslationWorkspace } from './campaign-translation-workspace'

interface CampaignSpecifiedUsersSelectorProps {
  userIDs: number[]
  emails: string[]
  onUserIDsChange: (value: number[]) => void
  onEmailsChange: (value: string[]) => void
  immutable: boolean
}

const LazyCampaignSpecifiedUsersSelector = lazy(async () => {
  const module = await import('./campaign-specified-users-selector')
  return {
    default: module.CampaignSpecifiedUsersSelector,
  }
})

type RecallFixedAmountInputs = Record<RecallFixedCurrency, string>
type RecallScheduleMode = 'manual' | 'once' | 'daily' | 'weekly'

const DEFAULT_RECALL_TIMEZONE = 'Asia/Shanghai'

function getRecallScheduleMode(draft: RecallCampaignDraft): RecallScheduleMode {
  if (draft.execution_mode === 'scheduled_once') return 'once'
  if (draft.execution_mode === 'recurring') {
    return draft.schedule.frequency === 'weekly' ? 'weekly' : 'daily'
  }
  return 'manual'
}

function getDefaultFutureStartSeconds(): number {
  return Math.floor(Date.now() / 1000) + 86_400
}

function normalizeRecallScheduleForMode(
  draft: RecallCampaignDraft,
  mode: RecallScheduleMode
): RecallCampaignDraft {
  const schedule = {
    ...draft.schedule,
    timezone:
      draft.schedule.timezone?.trim() &&
      draft.schedule.timezone.trim() !== 'UTC'
        ? draft.schedule.timezone.trim()
        : DEFAULT_RECALL_TIMEZONE,
  }
  if (mode === 'manual') {
    return {
      ...draft,
      execution_mode: 'manual',
      schedule: {
        ...schedule,
        scheduled_at: 0,
        frequency: 'daily',
        weekday: 1,
      },
    }
  }
  const scheduledAt =
    schedule.scheduled_at > 0
      ? schedule.scheduled_at
      : getDefaultFutureStartSeconds()
  if (mode === 'once') {
    return {
      ...draft,
      execution_mode: 'scheduled_once',
      schedule: {
        ...schedule,
        scheduled_at: scheduledAt,
        frequency: 'daily',
        weekday: 1,
      },
    }
  }
  return {
    ...draft,
    execution_mode: 'recurring',
    schedule: {
      ...schedule,
      scheduled_at: scheduledAt,
      frequency: mode,
      weekday: mode === 'weekly' ? schedule.weekday : 1,
    },
  }
}

function createRecallEmailTemplates(
  templates: Record<string, RecallEmailTemplate> = {},
  campaignType: RecallCampaignDraft['campaign_type'] = 'promotion'
): Record<string, RecallEmailTemplate> {
  const starterHtml =
    campaignType === 'content_only'
      ? RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML
      : RECALL_EMAIL_STARTER_HTML
  const englishTemplate = templates.en ?? {
    subject: '',
    body_text: '',
    body_html: starterHtml,
  }
  return { ...templates, en: { ...englishTemplate } }
}

const recallFixedAmountPaths: Record<
  RecallFixedCurrency,
  FieldPath<RecallCampaignDraft>
> = {
  USD: 'discount_config.amount_off',
  INR: 'discount_config.currency_options.inr',
  BRL: 'discount_config.currency_options.brl',
  JPY: 'discount_config.currency_options.jpy',
}

function getRecallFixedMinorAmount(
  discount: RecallDiscountConfig,
  currency: RecallFixedCurrency
): number {
  if (currency === 'USD') return discount.amount_off
  return discount.currency_options[currency.toLowerCase()] ?? 0
}

function createRecallFixedAmountInputs(
  discount: RecallDiscountConfig
): RecallFixedAmountInputs {
  return Object.fromEntries(
    recallFixedCurrencies.map((currency) => [
      currency,
      formatRecallMinorAmount(
        currency,
        getRecallFixedMinorAmount(discount, currency)
      ),
    ])
  ) as RecallFixedAmountInputs
}

// eslint-disable-next-line react-refresh/only-export-components
export function createRecallCampaignFormDraft(
  draft: RecallCampaignDraft
): RecallCampaignDraft {
  const normalizedDraft =
    draft.coupon_source === 'automatic' &&
    draft.discount_config.type === 'fixed'
      ? normalizeRecallDiscountType(draft, 'fixed')
      : draft
  const preparedDraft = prepareRecallCampaignSubmitDraft(normalizedDraft)
  return {
    ...preparedDraft,
    promotion_expiry_mode: preparedDraft.promotion_expiry_mode || 'relative',
    promotion_expires_at: preparedDraft.promotion_expires_at ?? 0,
    defer_localization: true,
    email_sequence: preparedDraft.email_sequence.map((stage) => ({
      ...stage,
      templates: createRecallEmailTemplates(
        stage.templates,
        preparedDraft.campaign_type
      ),
    })),
  }
}

const audienceFields: Record<
  RecallCampaignDraft['audience_template'],
  { name: FieldPath<RecallCampaignDraft>; label: string; step?: string }[]
> = {
  first_purchase: [
    {
      name: 'audience_config.registration_age_days',
      label: 'Registration age days',
    },
    {
      name: 'audience_config.min_request_count',
      label: 'Minimum request count',
    },
    { name: 'audience_config.max_quota', label: 'Maximum quota' },
    {
      name: 'audience_config.last_api_call_age_days',
      label: 'Last API call age days',
    },
  ],
  lapsed_payer: [
    {
      name: 'audience_config.min_paid_amount',
      label: 'Minimum paid amount',
      step: '0.01',
    },
    {
      name: 'audience_config.last_api_call_age_days',
      label: 'Last API call age days',
    },
    {
      name: 'audience_config.last_payment_age_days',
      label: 'Last payment age days',
    },
    { name: 'audience_config.max_quota', label: 'Maximum quota' },
  ],
  expired_subscription: [
    {
      name: 'audience_config.subscription_expired_days',
      label: 'Subscription expired days',
    },
    {
      name: 'audience_config.min_subscription_amount',
      label: 'Minimum subscription amount',
      step: '0.01',
    },
    {
      name: 'audience_config.min_subscription_count',
      label: 'Minimum subscription count',
    },
    {
      name: 'audience_config.last_api_call_age_days',
      label: 'Last API call age days',
    },
  ],
  registered_only: [],
  registration_time_range: [],
  specified_users: [],
}

function createRecallCampaignDefaults(): RecallCampaignDraft {
  return {
    campaign_type: 'promotion',
    name: '',
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
      registration_start_at: 0,
      registration_end_at: 0,
      specified_user_ids: [],
      specified_emails: [],
    },
    execution_mode: 'manual',
    schedule: {
      scheduled_at: 0,
      timezone: DEFAULT_RECALL_TIMEZONE,
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
    },
    product_scope: { topup_price_ids: [], subscription_price_ids: [] },
    promotion_expiry_mode: 'relative',
    promotion_expires_at: 0,
    promotion_valid_seconds: 604800,
    enrollment_limit: 1000,
    worker_concurrency: 5,
    email_sequence: [
      {
        stage_no: 1,
        delay_seconds: 0,
        template_version: 1,
        templates: createRecallEmailTemplates(),
      },
    ],
    defer_localization: true,
  }
}

interface CampaignEditorProps {
  campaignId?: number
  configRevision?: number
  initialDraft?: RecallCampaignDraft
  status?: RecallCampaignStatus
  focusBlocker?: RecallEmailLocalizationBlocker
  onSaved?: (campaignId: number) => void
  specifiedUsersSelector?: ComponentType<CampaignSpecifiedUsersSelectorProps>
}

export function CampaignEditor(props: CampaignEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutations = useRecallCampaignMutations(props.campaignId)
  const updateSchema =
    props.status && props.status !== 'draft'
      ? recallCampaignActivatedUpdateSchema
      : recallCampaignDraftSchema
  const defaultValues = createRecallCampaignFormDraft(
    props.initialDraft ?? createRecallCampaignDefaults()
  )
  const form = useForm<RecallCampaignDraft>({
    resolver: zodResolver(updateSchema),
    defaultValues,
  })
  const [persistedCampaignID, setPersistedCampaignID] = useState(
    props.campaignId ?? 0
  )
  const [persistedConfigRevision, setPersistedConfigRevision] = useState(
    props.configRevision ?? 0
  )
  const [activeTranslationTaskID, setActiveTranslationTaskID] = useState(0)
  const [translationTask, setTranslationTask] =
    useState<RecallTranslationTask>()
  const [pendingServerDraft, setPendingServerDraft] =
    useState<RecallCampaignDraft | null>(null)
  const invalidatedTranslationTasks = useRef(new Set<number>())
  const previousInitialDraft = useRef<RecallCampaignDraft | undefined>(
    undefined
  )
  const [fixedAmountInputs, setFixedAmountInputs] =
    useState<RecallFixedAmountInputs>(() =>
      createRecallFixedAmountInputs(defaultValues.discount_config)
    )
  const campaignType = form.watch('campaign_type')
  const audienceTemplate = form.watch('audience_template')
  const couponSource = form.watch('coupon_source')
  const discountType = form.watch('discount_config.type')
  const executionMode = form.watch('execution_mode')
  const scheduleMode = getRecallScheduleMode(form.watch())
  const groups = form.watch('audience_config.groups')
  const groupMode = form.watch('audience_config.group_mode')
  const providers = form.watch('audience_config.payment_providers')
  const specifiedUserIDs = form.watch('audience_config.specified_user_ids')
  const specifiedEmails = form.watch('audience_config.specified_emails')
  const topUpPrices = form.watch('product_scope.topup_price_ids')
  const subscriptionPrices = form.watch('product_scope.subscription_price_ids')
  const isDirty = form.formState.isDirty
  const immutable = Boolean(props.status && props.status !== 'draft')
  const automaticFixed =
    couponSource === 'automatic' && discountType === 'fixed'
  const terminal = props.status === 'cancelled' || props.status === 'completed'
  const isPromotionCampaign = campaignType === 'promotion'
  const isSaving = mutations.create.isPending || mutations.update.isPending
  const SpecifiedUsersSelector =
    props.specifiedUsersSelector ?? LazyCampaignSpecifiedUsersSelector
  const usesRegistrationRange =
    audienceTemplate === 'registered_only' ||
    audienceTemplate === 'registration_time_range'
  const showGroupFilter = audienceTemplate !== 'specified_users'
  const showGroupSelector = showGroupFilter && groupMode !== ''
  const showPaymentProviders =
    audienceTemplate === 'lapsed_payer' ||
    audienceTemplate === 'expired_subscription'
  const registrationStartError = form.getFieldState(
    'audience_config.registration_start_at',
    form.formState
  ).error
  const registrationEndError = form.getFieldState(
    'audience_config.registration_end_at',
    form.formState
  ).error
  const specifiedUserIDsError = form.getFieldState(
    'audience_config.specified_user_ids',
    form.formState
  ).error
  const specifiedEmailsError = form.getFieldState(
    'audience_config.specified_emails',
    form.formState
  ).error
  const scheduledAtError = form.getFieldState(
    'schedule.scheduled_at',
    form.formState
  ).error
  const scheduleTimezoneError = form.getFieldState(
    'schedule.timezone',
    form.formState
  ).error
  const scheduleWeekdayError = form.getFieldState(
    'schedule.weekday',
    form.formState
  ).error

  useEffect(() => {
    if (props.initialDraft === previousInitialDraft.current) return
    previousInitialDraft.current = props.initialDraft
    if (props.initialDraft) {
      const draft = createRecallCampaignFormDraft(props.initialDraft)
      if (form.formState.isDirty) {
        setPendingServerDraft(draft)
        return
      }
      form.reset(draft)
      setPendingServerDraft(null)
      setFixedAmountInputs(createRecallFixedAmountInputs(draft.discount_config))
    }
  }, [form, props.initialDraft])

  const latestTranslationTaskQuery = useQuery({
    queryKey: persistedCampaignID
      ? recallCampaignKeys.latestTranslationTask(persistedCampaignID)
      : recallCampaignKeys.latestTranslationTask(0),
    queryFn: () => getLatestRecallEmailTranslationTask(persistedCampaignID),
    enabled: persistedCampaignID > 0 && activeTranslationTaskID === 0,
    retry: false,
  })

  const activeTranslationTaskQuery = useQuery({
    queryKey:
      persistedCampaignID && activeTranslationTaskID
        ? recallCampaignKeys.translationTask(
            persistedCampaignID,
            activeTranslationTaskID
          )
        : recallCampaignKeys.translationTask(0, 0),
    queryFn: () =>
      getRecallEmailTranslationTask(
        persistedCampaignID,
        activeTranslationTaskID
      ),
    enabled: persistedCampaignID > 0 && activeTranslationTaskID > 0,
    retry: false,
    refetchInterval: (query) => {
      const task = query.state.data?.data
      return task && isRecallTranslationTaskActive(task.status) ? 2_000 : false
    },
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    const task = latestTranslationTaskQuery.data?.data
    if (!task || activeTranslationTaskID !== 0) return
    setTranslationTask(task)
    if (isRecallTranslationTaskActive(task.status)) {
      setActiveTranslationTaskID(task.id)
    }
  }, [activeTranslationTaskID, latestTranslationTaskQuery.data])

  useEffect(() => {
    const task = activeTranslationTaskQuery.data?.data
    if (!task) return
    setTranslationTask(task)
  }, [activeTranslationTaskQuery.data])

  useEffect(() => {
    if (
      !translationTask ||
      !isRecallTranslationTaskTerminal(translationTask.status)
    ) {
      return
    }
    if (translationTask.status !== 'succeeded') return
    if (invalidatedTranslationTasks.current.has(translationTask.id)) return
    invalidatedTranslationTasks.current.add(translationTask.id)
    if (persistedCampaignID > 0) {
      void queryClient.invalidateQueries({
        queryKey: recallCampaignKeys.detail(persistedCampaignID),
      })
    }
  }, [persistedCampaignID, queryClient, translationTask])

  useEffect(() => {
    setPersistedCampaignID(props.campaignId ?? 0)
    setPersistedConfigRevision(props.configRevision ?? 0)
  }, [props.campaignId, props.configRevision])

  const setCsv = (
    path: 'audience_config.groups' | 'audience_config.payment_providers',
    value: string
  ) => {
    form.setValue(
      path,
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  const setGroupMode = (
    mode: RecallCampaignDraft['audience_config']['group_mode']
  ) => {
    void setRecallCampaignGroupMode(form, mode).catch(() => {
      toast.error(t('Something went wrong!'))
    })
  }

  const setGroups = (value: string[]) => {
    void setRecallCampaignGroups(form, value).catch(() => {
      toast.error(t('Something went wrong!'))
    })
  }

  const persistDraft = async (
    draft: RecallCampaignDraft,
    notifySaved: boolean
  ): Promise<{ id: number; configRevision: number } | null> => {
    const normalizedDraft = prepareRecallCampaignSubmitDraft(draft)
    const campaignID = persistedCampaignID || props.campaignId
    const response = campaignID
      ? await mutations.update.mutateAsync({
          id: campaignID,
          draft: normalizedDraft,
        })
      : await mutations.create.mutateAsync(normalizedDraft)
    if (!response.success || !response.data) return null
    const result = {
      id: response.data.id,
      configRevision: response.data.config_revision || persistedConfigRevision,
    }
    setPersistedCampaignID(result.id)
    setPersistedConfigRevision(result.configRevision)
    if (notifySaved) {
      toast.success(campaignID ? t('Campaign updated') : t('Campaign created'))
      props.onSaved?.(result.id)
    } else if (!campaignID) {
      props.onSaved?.(result.id)
    }
    return result
  }

  const onSubmit = async (draft: RecallCampaignDraft) => {
    await persistDraft(draft, true)
  }

  const applyPendingServerDraft = () => {
    if (!pendingServerDraft) return
    form.reset(pendingServerDraft)
    setFixedAmountInputs(
      createRecallFixedAmountInputs(pendingServerDraft.discount_config)
    )
    setPendingServerDraft(null)
  }

  const generateTranslations = async () => {
    let campaignID = persistedCampaignID
    let configRevision = persistedConfigRevision
    if (!campaignID || isDirty) {
      const valid = await form.trigger()
      if (!valid) throw new Error('Please correct the highlighted fields.')
      const saved = await persistDraft(form.getValues(), false)
      if (!saved) throw new Error('Recall campaign request failed')
      campaignID = saved.id
      configRevision = saved.configRevision
    }
    if (!campaignID || configRevision <= 0) {
      throw new Error('Recall campaign revision is required')
    }

    const draft = prepareRecallCampaignSubmitDraft(form.getValues())
    const response = await mutations.generate.mutateAsync({
      id: campaignID,
      request: {
        config_revision: configRevision,
        name: draft.name,
        email_sequence: draft.email_sequence,
      },
    })
    if (!response.success || !response.data) {
      throw new Error('Translation generation failed')
    }
    setTranslationTask(response.data)
    setActiveTranslationTaskID(response.data.id)
    setPersistedConfigRevision(response.data.requested_config_revision)
  }

  const setScheduleMode = (mode: RecallScheduleMode) => {
    const normalized = normalizeRecallScheduleForMode(form.getValues(), mode)
    form.setValue('execution_mode', normalized.execution_mode, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('schedule', normalized.schedule, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const setCouponSource = (value: RecallCampaignDraft['coupon_source']) => {
    const normalized = normalizeRecallCouponSource(form.getValues(), value)
    form.setValue('coupon_source', normalized.coupon_source, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('existing_coupon_id', normalized.existing_coupon_id, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('discount_config', normalized.discount_config, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setFixedAmountInputs(
      createRecallFixedAmountInputs(normalized.discount_config)
    )
  }

  const setDiscountType = (
    value: RecallCampaignDraft['discount_config']['type']
  ) => {
    const normalized = normalizeRecallDiscountType(form.getValues(), value)
    form.setValue('discount_config', normalized.discount_config, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setFixedAmountInputs(
      createRecallFixedAmountInputs(normalized.discount_config)
    )
  }

  const setFixedAmount = (currency: RecallFixedCurrency, value: string) => {
    setFixedAmountInputs((current) => ({ ...current, [currency]: value }))
    form.setValue(
      recallFixedAmountPaths[currency],
      parseRecallMajorAmount(currency, value) ?? 0,
      { shouldDirty: true, shouldValidate: true }
    )
  }

  const setCampaignType = (value: RecallCampaignDraft['campaign_type']) => {
    const current = form.getValues()
    form.setValue('campaign_type', value, {
      shouldDirty: true,
      shouldValidate: true,
    })
    const nextStarter =
      value === 'content_only'
        ? RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML
        : RECALL_EMAIL_STARTER_HTML
    current.email_sequence.forEach((stage, index) => {
      Object.keys(stage.templates).forEach((locale) => {
        const path =
          `email_sequence.${index}.templates.${locale}.body_html` as FieldPath<RecallCampaignDraft>
        const currentBody = stage.templates[locale]?.body_html ?? ''
        if (
          currentBody === RECALL_EMAIL_STARTER_HTML ||
          currentBody === RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML
        ) {
          form.setValue(path, nextStarter, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      })
    })
  }

  return (
    <form
      className='space-y-4'
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('1. Campaign and audience')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='recall-name'>{t('Campaign name')}</Label>
            <Input
              id='recall-name'
              disabled={immutable}
              {...form.register('name')}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Campaign type')}</Label>
            <Select
              disabled={immutable}
              value={campaignType}
              onValueChange={(value) =>
                value &&
                setCampaignType(value as RecallCampaignDraft['campaign_type'])
              }
              items={[
                { value: 'promotion', label: t('Promotion') },
                { value: 'content_only', label: t('Content only') },
              ]}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='promotion'>{t('Promotion')}</SelectItem>
                  <SelectItem value='content_only'>
                    {t('Content only')}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>{t('Audience template')}</Label>
            <Select
              disabled={immutable}
              value={audienceTemplate}
              onValueChange={(value) =>
                value &&
                form.setValue(
                  'audience_template',
                  value as RecallCampaignDraft['audience_template'],
                  { shouldDirty: true, shouldValidate: true }
                )
              }
              items={[
                { value: 'first_purchase', label: t('First purchase') },
                { value: 'lapsed_payer', label: t('Lapsed payer') },
                {
                  value: 'expired_subscription',
                  label: t('Expired subscription'),
                },
                { value: 'registered_only', label: t('Registered only') },
                {
                  value: 'registration_time_range',
                  label: t('Registration time range'),
                },
                { value: 'specified_users', label: t('Specified users') },
              ]}
            >
              <SelectTrigger
                aria-describedby='recall-audience-help'
                className='w-full'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='first_purchase'>
                    {t('First purchase')}
                  </SelectItem>
                  <SelectItem value='lapsed_payer'>
                    {t('Lapsed payer')}
                  </SelectItem>
                  <SelectItem value='expired_subscription'>
                    {t('Expired subscription')}
                  </SelectItem>
                  <SelectItem value='registered_only'>
                    {t('Registered only')}
                  </SelectItem>
                  <SelectItem value='registration_time_range'>
                    {t('Registration time range')}
                  </SelectItem>
                  <SelectItem value='specified_users'>
                    {t('Specified users')}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div
            id='recall-audience-help'
            className='bg-muted/50 text-muted-foreground space-y-1 rounded-md p-3 text-sm md:col-span-2'
          >
            <p>
              {t(
                'Audience templates define the base audience. The rules shown below narrow it further, and built-in eligibility filters also apply. Preview the audience before activation.'
              )}
            </p>
            <p aria-live='polite' className='text-foreground'>
              {t(audienceTemplateDescriptionKeys[audienceTemplate])}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('2. Audience rules')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-3'>
          {audienceFields[audienceTemplate].map((field) => (
            <div className='space-y-2' key={field.name}>
              <Label>{t(field.label)}</Label>
              <Input
                type='number'
                min={0}
                step={field.step ?? '1'}
                disabled={immutable}
                {...form.register(field.name, { valueAsNumber: true })}
              />
            </div>
          ))}
          {usesRegistrationRange ? (
            <fieldset
              aria-labelledby='recall-registration-range-label'
              className='rounded-lg border p-3 md:col-span-3'
            >
              <legend
                id='recall-registration-range-label'
                className='px-1 text-sm font-medium'
              >
                {t('Registration time range')}
              </legend>
              <div className='grid gap-4 md:grid-cols-2'>
                <Controller
                  control={form.control}
                  name='audience_config.registration_start_at'
                  render={({ field }) => (
                    <div className='space-y-2'>
                      <Label htmlFor='recall-registration-start-at'>
                        {t('Registration start')}
                      </Label>
                      <Input
                        {...field}
                        id='recall-registration-start-at'
                        type='datetime-local'
                        required
                        disabled={immutable}
                        aria-invalid={Boolean(registrationStartError)}
                        aria-describedby={
                          registrationStartError
                            ? 'recall-registration-start-at-error'
                            : undefined
                        }
                        value={recallUnixToLocalDateTime(field.value)}
                        onChange={(event) =>
                          field.onChange(
                            recallLocalDateTimeToUnix(event.target.value)
                          )
                        }
                      />
                      {registrationStartError ? (
                        <p
                          id='recall-registration-start-at-error'
                          role='alert'
                          className='text-destructive text-sm'
                        >
                          {t(String(registrationStartError.message))}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
                <Controller
                  control={form.control}
                  name='audience_config.registration_end_at'
                  render={({ field }) => (
                    <div className='space-y-2'>
                      <Label htmlFor='recall-registration-end-at'>
                        {t('Registration end')}
                      </Label>
                      <Input
                        {...field}
                        id='recall-registration-end-at'
                        type='datetime-local'
                        required
                        disabled={immutable}
                        aria-invalid={Boolean(registrationEndError)}
                        aria-describedby={
                          registrationEndError
                            ? 'recall-registration-end-at-error'
                            : undefined
                        }
                        value={recallUnixToLocalDateTime(field.value)}
                        onChange={(event) =>
                          field.onChange(
                            recallLocalDateTimeToUnix(event.target.value)
                          )
                        }
                      />
                      {registrationEndError ? (
                        <p
                          id='recall-registration-end-at-error'
                          role='alert'
                          className='text-destructive text-sm'
                        >
                          {t(String(registrationEndError.message))}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              </div>
            </fieldset>
          ) : null}
          {audienceTemplate === 'specified_users' ? (
            <div className='space-y-3 md:col-span-3'>
              <Suspense
                fallback={
                  <p
                    role='status'
                    aria-live='polite'
                    className='text-muted-foreground text-sm'
                  >
                    {t('Loading...')}
                  </p>
                }
              >
                <SpecifiedUsersSelector
                  userIDs={specifiedUserIDs}
                  emails={specifiedEmails}
                  onUserIDsChange={(value) =>
                    form.setValue('audience_config.specified_user_ids', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onEmailsChange={(value) =>
                    form.setValue('audience_config.specified_emails', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  immutable={immutable}
                />
              </Suspense>
              {specifiedUserIDsError ? (
                <p role='alert' className='text-destructive text-sm'>
                  {t(String(specifiedUserIDsError.message))}
                </p>
              ) : null}
              {specifiedEmailsError ? (
                <p role='alert' className='text-destructive text-sm'>
                  {t(String(specifiedEmailsError.message))}
                </p>
              ) : null}
            </div>
          ) : null}
          {showGroupFilter ? (
            <>
              {showGroupSelector ? (
                <CampaignGroupSelector
                  groups={groups}
                  groupMode={groupMode}
                  onChange={setGroups}
                  immutable={immutable}
                />
              ) : null}
              <div className='space-y-2'>
                <Label>{t('Group mode')}</Label>
                <Select
                  disabled={immutable}
                  value={groupMode}
                  onValueChange={(value) =>
                    setGroupMode(
                      (value ??
                        '') as RecallCampaignDraft['audience_config']['group_mode']
                    )
                  }
                  items={[
                    { value: '', label: t('No group filter') },
                    { value: 'allow', label: t('Allow groups') },
                    { value: 'block', label: t('Block groups') },
                  ]}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value=''>{t('No group filter')}</SelectItem>
                      <SelectItem value='allow'>{t('Allow groups')}</SelectItem>
                      <SelectItem value='block'>{t('Block groups')}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <p className='text-muted-foreground text-sm md:col-span-3'>
                {t(
                  'Choose Allow or Block, then select the user groups to include or exclude. With no group filter, eligible users from every group are included.'
                )}
              </p>
            </>
          ) : null}
          {showPaymentProviders && (
            <div className='space-y-2'>
              <Label>{t('Payment providers (comma separated)')}</Label>
              <Input
                disabled={immutable}
                value={providers.join(', ')}
                onChange={(event) =>
                  setCsv(
                    'audience_config.payment_providers',
                    event.target.value
                  )
                }
              />
            </div>
          )}
          <label className='flex items-center gap-2 md:col-span-3'>
            <input
              type='checkbox'
              disabled={immutable}
              {...form.register('audience_config.require_verified_email')}
            />
            {t('Require verified email')}
          </label>
        </CardContent>
      </Card>

      {isPromotionCampaign ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('3. Stripe Coupon')}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-3'>
            <div className='space-y-2'>
              <Label>{t('Coupon source')}</Label>
              <Select
                disabled={immutable}
                value={couponSource}
                onValueChange={(value) =>
                  value &&
                  setCouponSource(value as RecallCampaignDraft['coupon_source'])
                }
                items={[
                  { value: 'automatic', label: t('Automatic Coupon') },
                  { value: 'existing', label: t('Existing Coupon') },
                ]}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='automatic'>
                      {t('Automatic Coupon')}
                    </SelectItem>
                    <SelectItem value='existing'>
                      {t('Existing Coupon')}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {couponSource === 'existing' ? (
              <div className='space-y-2 md:col-span-2'>
                <Label>{t('Existing Coupon ID')}</Label>
                <Input
                  disabled={immutable}
                  {...form.register('existing_coupon_id')}
                />
              </div>
            ) : null}
            <div className='space-y-2'>
              <Label>{t('Discount type')}</Label>
              <Select
                disabled={immutable}
                value={discountType}
                onValueChange={(value) =>
                  value &&
                  setDiscountType(
                    value as RecallCampaignDraft['discount_config']['type']
                  )
                }
                items={[
                  { value: 'percent', label: t('Percent') },
                  { value: 'fixed', label: t('Fixed amount') },
                ]}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='percent'>{t('Percent')}</SelectItem>
                    <SelectItem value='fixed'>{t('Fixed amount')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {discountType === 'percent' ? (
              <div className='space-y-2'>
                <Label>{t('Percent off')}</Label>
                <Input
                  type='number'
                  min={0.01}
                  max={100}
                  step='0.01'
                  disabled={immutable}
                  {...form.register('discount_config.percent_off', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            ) : automaticFixed ? (
              <>
                <p className='text-muted-foreground text-sm md:col-span-3'>
                  {t(
                    'Stripe does not convert fixed Coupon amounts automatically. Configure each checkout currency explicitly.'
                  )}
                </p>
                {recallFixedCurrencies.map((currency) => (
                  <div className='space-y-2' key={currency}>
                    <Label>{t('{{currency}} amount off', { currency })}</Label>
                    <Input
                      type='number'
                      min={currency === 'JPY' ? 1 : 0.01}
                      step={currency === 'JPY' ? '1' : '0.01'}
                      disabled={immutable}
                      value={fixedAmountInputs[currency]}
                      onChange={(event) =>
                        setFixedAmount(currency, event.target.value)
                      }
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className='space-y-2'>
                  <Label>{t('Amount off')}</Label>
                  <Input
                    type='number'
                    min={1}
                    disabled={immutable}
                    {...form.register('discount_config.amount_off', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Currency')}</Label>
                  <Input
                    maxLength={3}
                    placeholder='USD'
                    disabled={immutable}
                    {...form.register('discount_config.currency')}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('4. Activity delivery')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          {isPromotionCampaign ? (
            <>
              <CampaignProductSelector
                topUpPriceIDs={topUpPrices}
                subscriptionPriceIDs={subscriptionPrices}
                onTopUpChange={(value) =>
                  form.setValue('product_scope.topup_price_ids', value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onSubscriptionChange={(value) =>
                  form.setValue('product_scope.subscription_price_ids', value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                immutable={immutable}
              />
              <CampaignOfferValidityFields form={form} immutable={immutable} />
            </>
          ) : (
            <div className='space-y-2'>
              <Label>{t('Activity delivery validity seconds')}</Label>
              <Input
                type='number'
                min={1}
                disabled={immutable}
                {...form.register('promotion_valid_seconds', {
                  valueAsNumber: true,
                })}
              />
            </div>
          )}
          <div className='space-y-2'>
            <Label>{t('Enrollment limit')}</Label>
            <Input
              type='number'
              min={1}
              max={100000}
              disabled={immutable}
              {...form.register('enrollment_limit', { valueAsNumber: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Worker concurrency')}</Label>
            <Input
              type='number'
              min={1}
              max={20}
              disabled={immutable}
              {...form.register('worker_concurrency', {
                valueAsNumber: true,
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('5. Execution schedule')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-3'>
          <div className='space-y-2'>
            <Label>{t('Execution mode')}</Label>
            <Select
              disabled={immutable}
              value={scheduleMode}
              onValueChange={(value) =>
                value && setScheduleMode(value as RecallScheduleMode)
              }
              items={[
                { value: 'manual', label: t('Manual') },
                { value: 'once', label: t('Once') },
                { value: 'daily', label: t('Daily') },
                { value: 'weekly', label: t('Weekly') },
              ]}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='manual'>{t('Manual')}</SelectItem>
                  <SelectItem value='once'>{t('Once')}</SelectItem>
                  <SelectItem value='daily'>{t('Daily')}</SelectItem>
                  <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {executionMode !== 'manual' ? (
            <>
              <div className='space-y-2'>
                <Label htmlFor='recall-schedule-start-at'>
                  {t('Start date and time')}
                </Label>
                <Controller
                  control={form.control}
                  name='schedule.scheduled_at'
                  render={({ field }) => (
                    <Input
                      id='recall-schedule-start-at'
                      type='datetime-local'
                      disabled={immutable}
                      aria-invalid={Boolean(scheduledAtError)}
                      aria-describedby={
                        scheduledAtError
                          ? 'recall-schedule-start-at-error'
                          : undefined
                      }
                      value={recallUnixToLocalDateTime(field.value)}
                      onChange={(event) => {
                        const nextValue = recallLocalDateTimeToUnix(
                          event.target.value
                        )
                        field.onChange(nextValue)
                        const date = new Date(nextValue * 1000)
                        if (!Number.isNaN(date.getTime())) {
                          form.setValue('schedule.hour', date.getHours(), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          form.setValue('schedule.minute', date.getMinutes(), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      }}
                    />
                  )}
                />
                {scheduledAtError ? (
                  <p
                    id='recall-schedule-start-at-error'
                    role='alert'
                    className='text-destructive text-sm'
                  >
                    {t(String(scheduledAtError.message))}
                  </p>
                ) : null}
              </div>
              <div className='space-y-2'>
                <Label htmlFor='recall-schedule-timezone'>
                  {t('IANA timezone')}
                </Label>
                <Input
                  id='recall-schedule-timezone'
                  placeholder={DEFAULT_RECALL_TIMEZONE}
                  disabled={immutable}
                  aria-invalid={Boolean(scheduleTimezoneError)}
                  aria-describedby={
                    scheduleTimezoneError
                      ? 'recall-schedule-timezone-error'
                      : undefined
                  }
                  {...form.register('schedule.timezone')}
                />
                {scheduleTimezoneError ? (
                  <p
                    id='recall-schedule-timezone-error'
                    role='alert'
                    className='text-destructive text-sm'
                  >
                    {t(String(scheduleTimezoneError.message))}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {executionMode === 'recurring' ? (
            <>
              {form.watch('schedule.frequency') === 'weekly' ? (
                <div className='space-y-2'>
                  <Label htmlFor='recall-schedule-weekday'>
                    {t('Weekday')}
                  </Label>
                  <Input
                    id='recall-schedule-weekday'
                    type='number'
                    min={0}
                    max={6}
                    disabled={immutable}
                    aria-invalid={Boolean(scheduleWeekdayError)}
                    aria-describedby={
                      scheduleWeekdayError
                        ? 'recall-schedule-weekday-error'
                        : undefined
                    }
                    {...form.register('schedule.weekday', {
                      valueAsNumber: true,
                    })}
                  />
                  {scheduleWeekdayError ? (
                    <p
                      id='recall-schedule-weekday-error'
                      role='alert'
                      className='text-destructive text-sm'
                    >
                      {t(String(scheduleWeekdayError.message))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('6. Email sequence')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <CampaignTranslationWorkspace
            disabled={terminal}
            focusBlocker={props.focusBlocker}
            form={form}
            immutable={immutable}
            isGenerating={mutations.generate.isPending}
            onGenerate={generateTranslations}
            onApplyServerRefresh={applyPendingServerDraft}
            serverRefreshPending={Boolean(pendingServerDraft)}
            translationTask={translationTask}
          />
        </CardContent>
      </Card>

      {Object.keys(form.formState.errors).length > 0 ? (
        <p className='text-destructive text-sm'>
          {t('Please correct the highlighted fields.')}
        </p>
      ) : null}
      <Button type='submit' disabled={isSaving || terminal}>
        {isSaving ? t('Saving') : t('Save campaign')}
      </Button>
    </form>
  )
}
