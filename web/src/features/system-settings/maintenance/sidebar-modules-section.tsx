import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  SIDEBAR_MODULES_DEFAULT,
  type SidebarModulesAdminConfig,
  serializeSidebarModulesAdmin,
} from './config'

type SidebarModulesSectionProps = {
  config: SidebarModulesAdminConfig
  initialSerialized: string
}

type SidebarFormValues = SidebarModulesAdminConfig

const sectionMeta: Record<string, { title: string; description: string }> = {
  chat: {
    title: 'Chat area',
    description: 'Playground experiments and live conversations.',
  },
  console: {
    title: 'Console area',
    description: 'Dashboards, tokens, and usage analytics.',
  },
  personal: {
    title: 'Personal area',
    description: 'Wallet management and personal preferences.',
  },
  admin: {
    title: 'Admin area',
    description: 'Global configuration and administrative tools.',
  },
}

const moduleMeta: Record<
  string,
  Record<string, { title: string; description: string }>
> = {
  chat: {
    playground: {
      title: 'Playground',
      description: 'Experiment with prompts and models in real time.',
    },
    chat: {
      title: 'Chat',
      description: 'Access previous conversations and start new ones.',
    },
  },
  console: {
    detail: {
      title: 'Dashboard',
      description: 'Aggregated usage metrics and trend charts.',
    },
    token: {
      title: 'Token management',
      description: 'Create, revoke, and audit API tokens.',
    },
    log: {
      title: 'Usage logs',
      description: 'Detailed request logs for investigations.',
    },
    midjourney: {
      title: 'Drawing logs',
      description: 'History of Midjourney-style image tasks.',
    },
    task: {
      title: 'Task logs',
      description: 'Background job tracker for queued work.',
    },
  },
  personal: {
    topup: {
      title: 'Wallet',
      description: 'Top up balance and view billing history.',
    },
    personal: {
      title: 'Profile',
      description: 'Personal settings and profile management.',
    },
  },
  admin: {
    channel: {
      title: 'Channels',
      description: 'Configure upstream providers and routing.',
    },
    models: {
      title: 'Models',
      description: 'Manage catalog visibility and pricing.',
    },
    redemption: {
      title: 'Redeem codes',
      description: 'Create and review invite or credit codes.',
    },
    user: {
      title: 'Users',
      description: 'Administer user accounts and roles.',
    },
    setting: {
      title: 'System settings',
      description: 'Advanced platform configuration.',
    },
  },
}

const toTitleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export function SidebarModulesSection({
  config,
  initialSerialized,
}: SidebarModulesSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formDefaults = useMemo(() => config, [config])

  const form = useForm<SidebarFormValues>({
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: SidebarFormValues) => {
    const serialized = serializeSidebarModulesAdmin(values)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'SidebarModulesAdmin',
      value: serialized,
    })
  }

  const resetToDefault = () => {
    form.reset(SIDEBAR_MODULES_DEFAULT)
  }

  const sections = Object.entries(config)

  return (
    <SettingsAccordion
      value='sidebar-modules'
      title={t('Sidebar modules')}
      description={t(
        'Control which sidebar areas and modules are available to all users.'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {sections.map(([sectionKey, sectionConfig]) => {
            const sectionInfo = sectionMeta[sectionKey] ?? {
              title: toTitleCase(sectionKey),
              description: 'Custom sidebar section',
            }
            const modules = Object.entries(sectionConfig).filter(
              ([moduleKey]) => moduleKey !== 'enabled'
            )

            return (
              <div key={sectionKey} className='rounded-lg border p-4'>
                <FormField
                  control={form.control}
                  name={`${sectionKey}.enabled` as any}
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5 pe-4'>
                        <FormLabel className='text-base'>
                          {t(sectionInfo.title)}
                        </FormLabel>
                        <FormDescription>
                          {t(sectionInfo.description)}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className='mt-4 grid gap-4 md:grid-cols-2'>
                  {modules.map(([moduleKey]) => {
                    const moduleInfo = moduleMeta[sectionKey]?.[moduleKey] ?? {
                      title: toTitleCase(moduleKey),
                      description: 'Custom module',
                    }
                    return (
                      <FormField
                        key={`${sectionKey}.${moduleKey}`}
                        control={form.control}
                        name={`${sectionKey}.${moduleKey}` as any}
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                            <div className='space-y-0.5 pe-4'>
                              <FormLabel className='text-base'>
                                {t(moduleInfo.title)}
                              </FormLabel>
                              <FormDescription>
                                {t(moduleInfo.description)}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={Boolean(field.value)}
                                onCheckedChange={field.onChange}
                                disabled={
                                  !form.watch(`${sectionKey}.enabled` as any)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className='flex flex-wrap gap-3'>
            <Button type='button' variant='outline' onClick={resetToDefault}>
              {t('Reset to default')}
            </Button>
            <Button type='submit' disabled={updateOption.isPending}>
              {updateOption.isPending ? 'Saving...' : 'Save sidebar modules'}
            </Button>
          </div>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
