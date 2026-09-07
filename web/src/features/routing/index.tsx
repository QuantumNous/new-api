/*
Copyright (C) 2023-2026 QuantumNous
*/

import { zodResolver } from '@hookform/resolvers/zod'
import { Route, Save, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { getRoutingPreferences, updateRoutingPreferences } from './api'
import { toGlobalRoutingPreferences } from './lib/routing-preferences'
import type {
  GlobalRoutingFormValues,
  RoutingMode,
  RoutingPreference,
} from './types'

const modeValues = [
  'balanced',
  'price',
  'throughput',
  'latency',
  'quality',
] as const satisfies readonly RoutingMode[]

const modeLabels: Record<RoutingMode, string> = {
  balanced: 'Default (balanced)',
  price: 'Price (cheapest first)',
  latency: 'Latency (lowest first)',
  throughput: 'Throughput (highest first)',
  quality: 'Exacto (tool-call quality first)',
}

const formSchema = z.object({
  mode: z.enum(modeValues),
  allow_fallbacks: z.boolean(),
  max_attempts: z.number().int().min(0).max(20),
  max_price: z.number().min(0),
  min_quality_score: z.number().min(0).max(1),
  preference_version: z.string().trim().max(128),
})

const defaultValues: GlobalRoutingFormValues = {
  mode: 'balanced',
  allow_fallbacks: true,
  max_attempts: 3,
  max_price: 0,
  min_quality_score: 0,
  preference_version: '',
}

export function Routing() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingPreferences, setExistingPreferences] = useState<
    Record<string, RoutingPreference>
  >({})
  const form = useForm<GlobalRoutingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  useEffect(() => {
    let cancelled = false
    void getRoutingPreferences()
      .then((response) => {
        if (cancelled) return
        const preferences = response.data?.routing_preferences ?? {}
        const preference = preferences['*']
        setExistingPreferences(preferences)
        form.reset({
          ...defaultValues,
          ...preference,
          mode: preference?.mode || defaultValues.mode,
          allow_fallbacks:
            preference?.allow_fallbacks ?? defaultValues.allow_fallbacks,
          max_attempts: preference?.max_attempts ?? defaultValues.max_attempts,
          max_price: preference?.max_price ?? defaultValues.max_price,
          min_quality_score:
            preference?.min_quality_score ?? defaultValues.min_quality_score,
          preference_version:
            preference?.preference_version ?? defaultValues.preference_version,
        })
      })
      .catch(() => toast.error(t('Failed to load routing preferences')))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [form, t])

  const onSubmit = async (values: GlobalRoutingFormValues) => {
    setSaving(true)
    try {
      const response = await updateRoutingPreferences({
        ...existingPreferences,
        ...toGlobalRoutingPreferences(values),
      })
      if (!response.success) throw new Error(response.message || 'save failed')
      toast.success(t('Routing preferences saved'))
      form.reset(values)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to save routing preferences')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4 sm:py-6'>
        <div className='mx-auto w-full max-w-5xl space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <SlidersHorizontal className='size-4' />
                {t('Default Provider Sort')}
              </CardTitle>
              <CardDescription>
                {t(
                  'Choose how providers should be sorted for all model requests. Individual requests may override this setting.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className='text-muted-foreground text-sm'>
                  {t('Loading...')}
                </p>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className='space-y-6'
                  >
                    <FormField
                      control={form.control}
                      name='mode'
                      render={({ field }) => (
                        <FormItem className='max-w-xl'>
                          <FormLabel>{t('Provider sort')}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className='w-full'>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {modeValues.map((mode) => (
                                <SelectItem key={mode} value={mode}>
                                  {t(modeLabels[mode])}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t(
                              'This default applies to every model unless an individual request supplies an override.'
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className='border-border/60 space-y-4 rounded-lg border p-4'>
                      <div className='flex items-center gap-2'>
                        <Route className='text-muted-foreground size-4' />
                        <div>
                          <h3 className='text-sm font-medium'>
                            {t('Advanced routing constraints')}
                          </h3>
                          <p className='text-muted-foreground text-xs'>
                            {t(
                              'Optional global limits used while selecting a provider.'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className='grid gap-4 md:grid-cols-3'>
                        <FormField
                          control={form.control}
                          name='max_attempts'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Max attempts')}</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  max={20}
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                {t('0 uses the Scheduler default')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name='max_price'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Max price')}</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  step='any'
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                {t('USD per million tokens; 0 is unlimited')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name='min_quality_score'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Min quality')}</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  max={1}
                                  step='any'
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                {t('0 to 1; 0 is unlimited')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className='grid gap-4 md:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name='allow_fallbacks'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between rounded-md border p-3'>
                              <div>
                                <FormLabel>{t('Allow fallbacks')}</FormLabel>
                                <FormDescription>
                                  {t('Try the next candidate after a failure')}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name='preference_version'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Preference version')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder='e.g. rollout-2026-08-31'
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Optional audit label for Scheduler decisions'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button type='submit' disabled={saving}>
                      <Save className='size-4' />
                      {saving ? t('Saving...') : t('Save routing')}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Main>
  )
}
