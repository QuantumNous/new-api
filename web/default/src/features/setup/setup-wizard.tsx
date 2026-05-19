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
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LoadingState } from '@/components/loading-state'
import { buildSetupPayload, getSetupStatus, submitSetup } from './api'
import { AdminStep } from './components/admin-step'
import { CompleteStep } from './components/complete-step'
import { DatabaseStep } from './components/database-step'
import { StepNavigation } from './components/step-navigation'
import { UsageModeStep } from './components/usage-mode-step'
import type { SetupFormValues, SetupStatus } from './types'

const STEPS = [
  {
    titleKey: 'Database check',
    descriptionKey: 'Verify your database connection',
  },
  {
    titleKey: 'Administrator account',
    descriptionKey: 'Create credentials for the root user',
  },
  {
    titleKey: 'Usage mode',
    descriptionKey: 'Choose how the platform will operate',
  },
  {
    titleKey: 'Review & initialize',
    descriptionKey: 'Confirm settings and finish setup',
  },
]

const DEFAULT_FORM_VALUES: SetupFormValues = {
  username: '',
  password: '',
  confirmPassword: '',
  usageMode: 'external',
}

export function SetupWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logo, loading: systemConfigLoading } = useSystemConfig()

  const [currentStep, setCurrentStep] = useState(0)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | undefined>()

  const form = useForm<SetupFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  const watchedValues = form.watch()

  const {
    data: statusResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
    retry: false,
  })

  const mutation = useMutation({
    mutationKey: ['setup-submit'],
    mutationFn: submitSetup,
    onSuccess: async (response) => {
      if (response.success) {
        toast.success(t('System initialized successfully! Redirecting…'))
        await queryClient.invalidateQueries({ queryKey: ['setup-status'] })
        setTimeout(() => {
          navigate({ to: '/' })
        }, 1200)
      } else {
        toast.error(
          response.message || t('Initialization failed, please try again.')
        )
      }
    },
    onError: () => {
      toast.error(t('Failed to initialize system'))
    },
  })

  useEffect(() => {
    if (!statusResponse) return

    if (!statusResponse.success) {
      toast.error(statusResponse.message || t('Failed to load setup status'))
      return
    }

    const status = statusResponse.data
    if (!status) return

    if (status.status) {
      navigate({ to: '/' })
      return
    }

    setSetupStatus(status)
    setCurrentStep(0)

    // Pre-fill usage mode if backend echoes it
    if (status.SelfUseModeEnabled) {
      form.setValue('usageMode', 'self', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    } else if (status.DemoSiteEnabled) {
      form.setValue('usageMode', 'demo', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    } else {
      form.setValue('usageMode', 'external', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusResponse, navigate, form])

  useEffect(() => {
    if (!setupStatus) return

    // Reset admin fields when backend reports they are already initialized
    if (setupStatus.root_init) {
      form.setValue('username', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      form.setValue('password', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      form.setValue('confirmPassword', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    }
  }, [setupStatus, form])

  const currentStepComponent = useMemo(() => {
    if (currentStep === 0) {
      return <DatabaseStep status={setupStatus} />
    }
    if (currentStep === 1) {
      return (
        <AdminStep
          form={form}
          rootInitialized={Boolean(setupStatus?.root_init)}
        />
      )
    }
    if (currentStep === 2) {
      return <UsageModeStep form={form} />
    }
    return <CompleteStep status={setupStatus} values={watchedValues} />
  }, [currentStep, setupStatus, form, watchedValues])

  const validateAdminStep = () => {
    if (setupStatus?.root_init) return true

    const username = form.getValues('username')?.trim()
    const password = form.getValues('password')?.trim()
    const confirmPassword = form.getValues('confirmPassword')?.trim()

    if (!username) {
      form.setError('username', {
        type: 'manual',
        message: t('Please enter an administrator username'),
      })
      toast.error(t('Please enter an administrator username'))
      return false
    }

    if (!password || password.length < 8) {
      form.setError('password', {
        type: 'manual',
        message: t('Password must be at least 8 characters long'),
      })
      toast.error(t('Password must be at least 8 characters long'))
      return false
    }

    if (password !== confirmPassword) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: t('Passwords do not match'),
      })
      toast.error(t('Passwords do not match'))
      return false
    }

    return true
  }

  const validateUsageModeStep = () => {
    const usageMode = form.getValues('usageMode')
    if (!usageMode) {
      form.setError('usageMode', {
        type: 'manual',
        message: t('Select a usage mode to continue'),
      })
      toast.error(t('Select a usage mode to continue'))
      return false
    }
    return true
  }

  const handleNextStep = () => {
    if (currentStep === 1 && !validateAdminStep()) return
    if (currentStep === 2 && !validateUsageModeStep()) return

    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1))
  }

  const handlePreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  const handleSubmit = async () => {
    const adminValid = validateAdminStep()
    const usageValid = validateUsageModeStep()
    if (!adminValid || !usageValid) return

    const payload = buildSetupPayload(
      form.getValues(),
      Boolean(setupStatus?.root_init)
    )

    mutation.mutate(payload)
  }

  return (
    <div className='relative isolate min-h-svh overflow-hidden bg-slate-950 py-8 text-slate-50 sm:py-10'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-30 bg-[linear-gradient(135deg,#020617_0%,#0f172a_34%,#1e1b4b_68%,#111827_100%)]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.08)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_84%)] bg-[size:72px_72px]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[linear-gradient(90deg,rgba(14,165,233,0.16),rgba(99,102,241,0.22),rgba(168,85,247,0.16))]'
      />
      <div className='absolute top-4 right-4 z-10 text-slate-100 sm:top-6 sm:right-6 [&_button]:border [&_button]:border-white/10 [&_button]:bg-white/10 [&_button]:backdrop-blur-md [&_button:hover]:bg-white/15'>
        <LanguageSwitcher />
      </div>
      <div className='container mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6'>
        <div className='flex flex-col items-center gap-4 pt-8 text-center sm:pt-4'>
          <div className='inline-flex items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur-md'>
            {t('System setup wizard')}
          </div>
          <div className='relative h-14 w-14'>
            {systemConfigLoading ? (
              <Skeleton className='absolute inset-0 rounded-lg bg-white/10' />
            ) : (
              <img
                src={logo}
                alt={t('System logo')}
                className='h-14 w-14 rounded-lg border border-white/15 object-cover shadow-2xl shadow-cyan-950/40'
              />
            )}
          </div>
          {systemConfigLoading ? (
            <Skeleton className='h-8 w-72 max-w-full bg-white/10' />
          ) : (
            <h1 className='max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
              {DEFAULT_SYSTEM_NAME}
            </h1>
          )}
          <p className='max-w-2xl text-sm leading-6 text-slate-300 sm:text-base'>
            面向政企场景的一体化模型服务与AI资源运营平台
          </p>
          <p className='max-w-2xl text-sm leading-6 text-slate-400'>
            {t(
              'Follow the guided steps to prepare your workspace before the first login.'
            )}
          </p>
        </div>

        <Card className='rounded-lg border border-white/15 bg-slate-950/55 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.58)] ring-1 ring-cyan-200/10 backdrop-blur-xl'>
          <CardHeader className='space-y-2 border-b border-white/10 px-5 pb-5 sm:px-6'>
            <CardTitle className='text-xl font-semibold text-white'>
              {t('System setup wizard')}
            </CardTitle>
            <CardDescription className='text-slate-300/80'>
              {t('Complete these steps to finish the initial installation.')}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-6 px-5 sm:px-6 [&_.bg-card]:border-white/10 [&_.bg-card]:bg-white/[0.06] [&_.border]:border-white/10 [&_.text-foreground]:text-slate-50 [&_.text-muted-foreground]:text-slate-300/75 [&_[data-slot=input]]:border-white/15 [&_[data-slot=input]]:bg-slate-950/45 [&_[data-slot=input]]:text-slate-50 [&_[data-slot=input]]:placeholder:text-slate-500 [&_[data-slot=separator]]:bg-white/10 [&_label]:text-slate-100'>
            <ol className='grid gap-3 sm:grid-cols-4'>
              {STEPS.map((step, index) => {
                const isActive = currentStep === index
                const isCompleted = currentStep > index
                return (
                  <li
                    key={step.titleKey}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      isActive
                        ? 'border-cyan-300/55 bg-cyan-300/10 shadow-lg ring-2 shadow-cyan-950/25 ring-cyan-300/20'
                        : isCompleted
                          ? 'border-emerald-300/35 bg-emerald-300/10'
                          : 'border-white/10 bg-white/[0.04]'
                    )}
                  >
                    <div className='flex items-start gap-3'>
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
                          isActive
                            ? 'border-cyan-200 bg-cyan-300 text-slate-950'
                            : isCompleted
                              ? 'border-emerald-200 bg-emerald-300 text-slate-950'
                              : 'border-white/20 text-slate-400'
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className='space-y-1'>
                        <p className='text-sm font-semibold text-slate-50'>
                          {t(step.titleKey)}
                        </p>
                        <p className='text-xs leading-5 text-slate-400'>
                          {t(step.descriptionKey)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            {isLoading ? (
              <LoadingState message={t('Loading setup status…')} />
            ) : isError ? (
              <ErrorState
                title={t('We could not load the setup status.')}
                onRetry={() => refetch()}
              />
            ) : (
              <Form {...form}>
                <form
                  className='space-y-6'
                  onSubmit={(event) => event.preventDefault()}
                >
                  {currentStepComponent}
                </form>
              </Form>
            )}
          </CardContent>

          {!isLoading && !isError && (
            <CardFooter className='w-full justify-end border-t border-white/10 bg-white/[0.04] px-5 sm:px-6 [&_.bg-background]:border-white/15 [&_.bg-background]:bg-white/5 [&_.bg-background]:text-slate-100 [&_.bg-background:hover]:bg-white/10 [&_[data-slot=button]]:shadow-lg'>
              <StepNavigation
                currentStep={currentStep}
                totalSteps={STEPS.length}
                onBack={handlePreviousStep}
                onNext={handleNextStep}
                onSubmit={handleSubmit}
                isSubmitting={mutation.isPending}
              />
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
