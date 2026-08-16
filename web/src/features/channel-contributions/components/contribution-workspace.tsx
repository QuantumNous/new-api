/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'

import {
  createChannelContribution,
  createChannelContributionTestRun,
  fetchChannelContributionModels,
  getChannelContributionTestRun,
  submitChannelContribution,
  updateChannelContribution,
} from '../api'
import {
  createContributionFormSchema,
  contributionFormToPayload,
  contributionToFormValues,
  emptyContributionFormValues,
  filterContributionModelMappingToModels,
  type ContributionFormValues,
} from '../form-schema'
import {
  canEditContribution,
  executeTurnstileSubmission,
  getContributionRevision,
  getContributionTestRun,
  getTestRunId,
  isTestRunActive,
  parseContributionModels,
} from '../lib'
import type {
  ApiResponse,
  ChannelContribution,
  ChannelContributionConfig,
  ChannelContributionFetchModelsResult,
  ChannelContributionTestRun,
} from '../types'
import { ContributionAgreementDialog } from './agreement-dialog'
import { ContributionFormFields } from './contribution-form-fields'
import { ContributionReadinessPanel } from './contribution-readiness-panel'
import { ContributionStatusBadge } from './contribution-status'

function formFingerprint(values: ContributionFormValues): string {
  return JSON.stringify({
    name: values.name.trim(),
    type: values.type,
    base_url: values.base_url.trim(),
    key: values.key.trim(),
    group: values.group.trim(),
    models: parseContributionModels(values.models),
    model_mapping: values.model_mapping.trim(),
  })
}

function getFetchedModels(
  response: ApiResponse<ChannelContributionFetchModelsResult | string[]>
): string[] {
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to fetch models')
  }
  return parseContributionModels(
    Array.isArray(response.data) ? response.data : response.data.models
  )
}

export function ContributionWorkspace(props: {
  config: ChannelContributionConfig
  initialContribution: ChannelContribution | null
  onStartNew: () => void
  onChanged: (contribution: ChannelContribution) => void
  onSubmitted: (contribution: ChannelContribution) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [savedContribution, setSavedContribution] =
    useState<ChannelContribution | null>(props.initialContribution)
  const [savedFingerprint, setSavedFingerprint] = useState('')
  const [testRun, setTestRun] = useState<ChannelContributionTestRun | null>(
    getContributionTestRun(props.initialContribution)
  )
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const resetContributionId = useRef<number | null | undefined>(undefined)
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
  } = useTurnstile()

  const defaultValues = useMemo<ContributionFormValues>(() => {
    if (props.initialContribution) {
      return contributionToFormValues(props.initialContribution)
    }
    return {
      ...emptyContributionFormValues,
      type: props.config.allowed_channel_types[0]?.value ?? 1,
      group: props.config.allowed_groups[0] ?? '',
    }
  }, [props.config, props.initialContribution])
  const formSchema = useMemo(() => createContributionFormSchema(t), [t])

  const form = useForm<ContributionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const values = useWatch({ control: form.control }) as ContributionFormValues
  const currentFingerprint = formFingerprint(values)
  const unsaved = currentFingerprint !== savedFingerprint

  useEffect(() => {
    const contributionId = props.initialContribution?.id ?? null
    if (resetContributionId.current === contributionId) return
    resetContributionId.current = contributionId
    form.reset(defaultValues)
    setSavedContribution(props.initialContribution)
    setSavedFingerprint(formFingerprint(defaultValues))
    setTestRun(getContributionTestRun(props.initialContribution))
    setAgreementChecked(false)
    setTurnstileToken('')
    setTurnstileWidgetKey((current) => current + 1)
  }, [defaultValues, form, props.initialContribution, setTurnstileToken])

  const saveMutation = useMutation({
    mutationFn: async (request: {
      contributionId: number | null
      values: ContributionFormValues
    }) => {
      const payload = contributionFormToPayload(request.values)
      return request.contributionId
        ? updateChannelContribution(request.contributionId, payload)
        : createChannelContribution(payload)
    },
  })
  const fetchModelsMutation = useMutation({
    mutationFn: fetchChannelContributionModels,
  })
  const testMutation = useMutation({
    mutationFn: createChannelContributionTestRun,
  })
  const submitMutation = useMutation({
    mutationFn: (request: {
      id: number
      testRunId: number | string
      turnstile?: string
    }) =>
      submitChannelContribution(
        request.id,
        {
          test_run_id: request.testRunId,
          agreement_version: props.config.agreement_version,
          agreement_accepted: true,
        },
        request.turnstile
      ),
  })

  const runId = getTestRunId(testRun)
  const runQuery = useQuery({
    queryKey: ['channel-contribution-test-run', savedContribution?.id, runId],
    queryFn: () =>
      getChannelContributionTestRun(savedContribution?.id ?? 0, runId ?? ''),
    enabled: Boolean(
      savedContribution?.id && runId && isTestRunActive(testRun)
    ),
    refetchInterval: (query) => {
      const latest = query.state.data?.data ?? testRun
      return latest && isTestRunActive(latest) ? 1500 : false
    },
  })
  const displayedRun = runQuery.data?.data ?? testRun

  useEffect(() => {
    if (runQuery.data?.data) setTestRun(runQuery.data.data)
  }, [runQuery.data])

  const persistValues = async (
    nextValues: ContributionFormValues,
    existing: ChannelContribution | null
  ): Promise<ChannelContribution | null> => {
    const revision = getContributionRevision(existing)
    const needsKey = !existing || revision?.has_api_key === false
    if (needsKey && !nextValues.key.trim()) {
      form.setError('key', { message: t('API key is required') })
      return null
    }

    const response = await saveMutation.mutateAsync({
      contributionId: existing?.id ?? null,
      values: nextValues,
    })
    if (!response.success || !response.data) {
      toast.error(response.message || t('Failed to save contribution draft'))
      return null
    }

    const cleanValues = { ...nextValues, key: '' }
    form.reset(cleanValues)
    setSavedFingerprint(formFingerprint(cleanValues))
    setSavedContribution(response.data)
    setTestRun(getContributionTestRun(response.data))
    setAgreementChecked(false)
    props.onChanged(response.data)
    await queryClient.invalidateQueries({ queryKey: ['channel-contributions'] })
    return response.data
  }

  const ensureSaved = async (): Promise<ChannelContribution | null> => {
    const valid = await form.trigger()
    if (!valid) return null
    if (savedContribution && !unsaved) return savedContribution
    return persistValues(form.getValues(), savedContribution)
  }

  const handleSave = async () => {
    try {
      const saved = await ensureSaved()
      if (saved) toast.success(t('Contribution draft saved'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to save contribution draft')
      )
    }
  }

  const handleFetchModels = async () => {
    try {
      const saved = await ensureSaved()
      if (!saved) return
      const response = await fetchModelsMutation.mutateAsync(saved.id)
      const models = getFetchedModels(response)
      if (models.length === 0) {
        toast.error(t('The provider returned no models'))
        return
      }
      const currentValues = form.getValues()
      const nextValues = {
        ...currentValues,
        models,
        model_mapping: filterContributionModelMappingToModels(
          currentValues.model_mapping,
          models
        ),
        key: '',
      }
      form.reset(nextValues)
      const persisted = await persistValues(nextValues, saved)
      if (persisted) {
        toast.success(
          t('Fetched and saved {{count}} models', { count: models.length })
        )
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to fetch models')
      )
    }
  }

  const handleTest = async () => {
    try {
      if (form.getValues('models').length === 0) {
        form.setError('models', { message: t('Select at least one model') })
        return
      }
      const saved = await ensureSaved()
      if (!saved) return
      const response = await testMutation.mutateAsync(saved.id)
      if (!response.success || !response.data) {
        toast.error(response.message || t('Failed to start model tests'))
        return
      }
      setTestRun(response.data)
      setAgreementChecked(false)
      resetTurnstile()
      toast.success(t('Full model test started'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to start model tests')
      )
    }
  }

  const resetTurnstile = () => {
    setTurnstileToken('')
    setTurnstileWidgetKey((current) => current + 1)
  }

  const handleSubmit = async () => {
    if (!savedContribution) return
    const latestRunId = getTestRunId(displayedRun)
    if (!latestRunId) {
      toast.error(t('Run the full model test before submitting.'))
      return
    }
    try {
      const execution = await executeTurnstileSubmission({
        enabled: isTurnstileEnabled,
        token: turnstileToken,
        reset: resetTurnstile,
        submit: (token) =>
          submitMutation.mutateAsync({
            id: savedContribution.id,
            testRunId: latestRunId,
            turnstile: token,
          }),
      })
      const response = execution.result
      if (!execution.called || !response) return
      if (!response.success || !response.data) {
        toast.error(response.message || t('Failed to submit contribution'))
        return
      }
      setSavedContribution(response.data)
      setAgreementChecked(false)
      props.onSubmitted(response.data)
      await queryClient.invalidateQueries({
        queryKey: ['channel-contributions'],
      })
      toast.success(t('Contribution submitted for review'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to submit contribution')
      )
    }
  }

  const editable = !savedContribution || canEditContribution(savedContribution)
  const channelTypes = props.config.allowed_channel_types
  const busy =
    saveMutation.isPending ||
    fetchModelsMutation.isPending ||
    testMutation.isPending ||
    submitMutation.isPending ||
    isTestRunActive(displayedRun)

  return (
    <>
      <div className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.58fr)] lg:items-start'>
        <Card className='gap-0 py-0'>
          <CardHeader className='border-b py-4'>
            <CardTitle>
              {savedContribution
                ? t('Edit channel contribution')
                : t('Contribute a channel')}
            </CardTitle>
            <CardDescription>
              {t(
                'Only the connection details required for review are collected.'
              )}
            </CardDescription>
            <CardAction className='flex items-center gap-2'>
              {savedContribution ? (
                <ContributionStatusBadge status={savedContribution.status} />
              ) : null}
              {props.initialContribution ? (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={props.onStartNew}
                  disabled={busy}
                >
                  <Plus data-icon='inline-start' />
                  {t('New contribution')}
                </Button>
              ) : null}
            </CardAction>
          </CardHeader>
          <CardContent className='py-5'>
            <Form {...form}>
              <form onSubmit={(event) => event.preventDefault()}>
                <fieldset disabled={!editable}>
                  <ContributionFormFields
                    form={form}
                    channelTypes={channelTypes}
                    groups={props.config.allowed_groups}
                    disabled={!editable || busy}
                    editing={Boolean(savedContribution)}
                  />
                </fieldset>
              </form>
            </Form>
          </CardContent>
        </Card>

        <ContributionReadinessPanel
          saved={Boolean(savedContribution)}
          unsaved={unsaved}
          modelCount={values.models.length}
          run={displayedRun}
          priceConfigured={
            getContributionRevision(savedContribution)?.price_configured
          }
          busy={busy || !editable}
          saving={saveMutation.isPending}
          fetchingModels={fetchModelsMutation.isPending}
          testing={testMutation.isPending}
          onSave={handleSave}
          onFetchModels={handleFetchModels}
          onTest={handleTest}
          agreementChecked={agreementChecked}
          onAgreementCheckedChange={setAgreementChecked}
          onOpenAgreement={() => setAgreementOpen(true)}
          isTurnstileEnabled={isTurnstileEnabled}
          turnstileSiteKey={turnstileSiteKey}
          turnstileToken={turnstileToken}
          turnstileWidgetKey={turnstileWidgetKey}
          onTurnstileVerify={setTurnstileToken}
          onTurnstileExpire={() => setTurnstileToken('')}
          onSubmit={handleSubmit}
          submitting={submitMutation.isPending}
        />
      </div>

      <ContributionAgreementDialog
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        version={props.config.agreement_version}
        content={props.config.agreement_content}
      />
    </>
  )
}
