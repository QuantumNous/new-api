import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  HEADER_NAV_DEFAULT,
  type HeaderNavModulesConfig,
  serializeHeaderNavModules,
} from './config'

const headerNavSchema = z.object({
  home: z.boolean(),
  console: z.boolean(),
  pricingEnabled: z.boolean(),
  pricingRequireAuth: z.boolean(),
  docs: z.boolean(),
  about: z.boolean(),
})

type HeaderNavFormValues = z.infer<typeof headerNavSchema>

type HeaderNavigationSectionProps = {
  config: HeaderNavModulesConfig
  initialSerialized: string
}

const toFormValues = (config: HeaderNavModulesConfig): HeaderNavFormValues => ({
  home:
    config.home === undefined ? HEADER_NAV_DEFAULT.home : Boolean(config.home),
  console:
    config.console === undefined
      ? HEADER_NAV_DEFAULT.console
      : Boolean(config.console),
  pricingEnabled:
    config.pricing?.enabled === undefined
      ? HEADER_NAV_DEFAULT.pricing.enabled
      : Boolean(config.pricing.enabled),
  pricingRequireAuth:
    config.pricing?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.pricing.requireAuth
      : Boolean(config.pricing.requireAuth),
  docs:
    config.docs === undefined ? HEADER_NAV_DEFAULT.docs : Boolean(config.docs),
  about:
    config.about === undefined
      ? HEADER_NAV_DEFAULT.about
      : Boolean(config.about),
})

export function HeaderNavigationSection({
  config,
  initialSerialized,
}: HeaderNavigationSectionProps) {
  const updateOption = useUpdateOption()
  const formDefaults = useMemo(() => toFormValues(config), [config])

  const form = useForm<HeaderNavFormValues>({
    resolver: zodResolver(headerNavSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: HeaderNavFormValues) => {
    const payload: HeaderNavModulesConfig = {
      ...config,
      home: values.home,
      console: values.console,
      docs: values.docs,
      about: values.about,
      pricing: {
        ...(config.pricing ?? HEADER_NAV_DEFAULT.pricing),
        enabled: values.pricingEnabled,
        requireAuth: values.pricingRequireAuth,
      },
    }

    const serialized = serializeHeaderNavModules(payload)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'HeaderNavModules',
      value: serialized,
    })
  }

  const resetToDefault = () => {
    form.reset(toFormValues(HEADER_NAV_DEFAULT))
  }

  const modules: Array<{
    key: keyof HeaderNavFormValues
    title: string
    description: string
  }> = [
    {
      key: 'home',
      title: 'Home',
      description: 'Landing page with system overview.',
    },
    {
      key: 'console',
      title: 'Console',
      description: 'User dashboard and quota controls.',
    },
    {
      key: 'docs',
      title: 'Docs',
      description: 'Documentation or external knowledge base.',
    },
    {
      key: 'about',
      title: 'About',
      description: 'Static page describing the platform.',
    },
  ]

  return (
    <SettingsAccordion
      value='header-navigation'
      title='Header navigation'
      description='Enable or disable top navigation modules globally.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            {modules.map((module) => (
              <FormField
                key={module.key}
                control={form.control}
                name={module.key}
                render={({ field }) => (
                  <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5 pe-4'>
                      <FormLabel className='text-base'>
                        {module.title}
                      </FormLabel>
                      <FormDescription>{module.description}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <div className='rounded-lg border p-4'>
            <FormField
              control={form.control}
              name='pricingEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5 pe-4'>
                    <FormLabel className='text-base'>
                      Models directory
                    </FormLabel>
                    <FormDescription>
                      Exposes the pricing/models catalog in the top navigation.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='pricingRequireAuth'
              render={({ field }) => (
                <FormItem className='mt-4 flex flex-row items-start justify-between rounded-lg border border-dashed p-4'>
                  <div className='space-y-0.5 pe-4'>
                    <FormLabel className='text-base'>
                      Require login to view models
                    </FormLabel>
                    <FormDescription>
                      Visitors must authenticate before accessing the pricing
                      directory.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!form.watch('pricingEnabled')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='flex flex-wrap gap-3'>
            <Button type='button' variant='outline' onClick={resetToDefault}>
              Reset to default
            </Button>
            <Button type='submit' disabled={updateOption.isPending}>
              {updateOption.isPending ? 'Saving...' : 'Save navigation'}
            </Button>
          </div>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
