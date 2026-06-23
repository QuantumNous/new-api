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
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsControlChildren,
  SettingsForm,
  SettingsSwitchContent,
  SettingsControlGroup,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOptionsBulk } from '../hooks/use-update-option'
import type { UpdateOptionsRequest } from '../types'
import {
  SIDEBAR_MODULES_DEFAULT,
  type SidebarModulesAdminConfig,
  serializeSidebarModulesAdmin,
} from './config'
import {
  DEFAULT_PLAYGROUND_DEFAULT_MODEL,
  resolvePlaygroundDefaultModelToSave,
} from './sidebar-modules-utils'

type SidebarModulesSectionProps = {
  config: SidebarModulesAdminConfig
  initialSerialized: string
  playgroundDefaultModel: string
}

type SidebarFormValues = SidebarModulesAdminConfig

const toTitleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export function SidebarModulesSection({
  config,
  initialSerialized,
  playgroundDefaultModel,
}: SidebarModulesSectionProps) {
  const { t } = useTranslation()
  const updateOptionsBulk = useUpdateOptionsBulk()
  const initialPlaygroundDefaultModel = resolvePlaygroundDefaultModelToSave(
    playgroundDefaultModel
  )
  const [currentPlaygroundDefaultModel, setCurrentPlaygroundDefaultModel] =
    useState(initialPlaygroundDefaultModel)

  const sectionMeta: Record<string, { title: string; description: string }> = {
    chat: {
      title: t('Chat area'),
      description: t('Playground experiments and live conversations.'),
    },
    console: {
      title: t('Console area'),
      description: t('Dashboards, tokens, and usage analytics.'),
    },
    personal: {
      title: t('Personal area'),
      description: t('Wallet management and personal preferences.'),
    },
    admin: {
      title: t('Admin area'),
      description: t('Global configuration and administrative tools.'),
    },
  }

  const moduleMeta: Record<
    string,
    Record<string, { title: string; description: string }>
  > = {
    chat: {
      playground: {
        title: t('Playground'),
        description: t('Experiment with prompts and models in real time.'),
      },
      chat: {
        title: t('Chat'),
        description: t('Access previous conversations and start new ones.'),
      },
    },
    console: {
      detail: {
        title: t('Dashboard'),
        description: t('Aggregated usage metrics and trend charts.'),
      },
      token: {
        title: t('Token management'),
        description: t('Create, revoke, and audit API tokens.'),
      },
      log: {
        title: t('Usage logs'),
        description: t('Detailed request logs for investigations.'),
      },
      midjourney: {
        title: t('Drawing logs'),
        description: t('History of Midjourney-style image tasks.'),
      },
      task: {
        title: t('Task logs'),
        description: t('Background job tracker for queued work.'),
      },
    },
    personal: {
      topup: {
        title: t('Wallet'),
        description: t('Top up balance and view billing history.'),
      },
      personal: {
        title: t('Profile'),
        description: t('Personal settings and profile management.'),
      },
    },
    admin: {
      channel: {
        title: t('Channels'),
        description: t('Configure upstream providers and routing.'),
      },
      models: {
        title: t('Models'),
        description: t('Manage catalog visibility and pricing.'),
      },
      codex_governance: {
        title: t('Codex model governance'),
        description: t('Review unsupported Codex model findings.'),
      },
      redemption: {
        title: t('Redeem codes'),
        description: t('Create and review invite or credit codes.'),
      },
      user: {
        title: t('Users'),
        description: t('Administer user accounts and roles.'),
      },
      setting: {
        title: t('System settings'),
        description: t('Advanced platform configuration.'),
      },
      subscription: {
        title: t('Subscription Management'),
        description: t('Manage subscription plans and pricing.'),
      },
    },
  }
  const formDefaults = useMemo(() => config, [config])

  const form = useForm<SidebarFormValues>({
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  useEffect(() => {
    setCurrentPlaygroundDefaultModel(initialPlaygroundDefaultModel)
  }, [initialPlaygroundDefaultModel])

  const onSubmit = async (values: SidebarFormValues) => {
    const serialized = serializeSidebarModulesAdmin(values)
    const nextPlaygroundDefaultModel = resolvePlaygroundDefaultModelToSave(
      currentPlaygroundDefaultModel
    )
    if (
      serialized === initialSerialized &&
      nextPlaygroundDefaultModel === initialPlaygroundDefaultModel
    ) {
      return
    }

    const options: UpdateOptionsRequest['options'] = []
    if (serialized !== initialSerialized) {
      options.push({
        key: 'SidebarModulesAdmin',
        value: serialized,
      })
    }
    if (nextPlaygroundDefaultModel !== initialPlaygroundDefaultModel) {
      options.push({
        key: 'PlaygroundDefaultModel',
        value: nextPlaygroundDefaultModel,
      })
    }
    await updateOptionsBulk.mutateAsync({ options })
  }

  const resetToDefault = () => {
    form.reset(SIDEBAR_MODULES_DEFAULT)
    setCurrentPlaygroundDefaultModel(DEFAULT_PLAYGROUND_DEFAULT_MODEL)
  }

  const sections = Object.entries(config)

  return (
    <SettingsSection title={t('Sidebar modules')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOptionsBulk.isPending}
            resetLabel='Reset to default'
            saveLabel='Save sidebar modules'
          />
          {sections.map(([sectionKey, sectionConfig]) => {
            const sectionInfo = sectionMeta[sectionKey] ?? {
              title: toTitleCase(sectionKey),
              description: t('Custom sidebar section'),
            }
            const modules = Object.entries(sectionConfig).filter(
              ([moduleKey]) => moduleKey !== 'enabled'
            )

            return (
              <SettingsControlGroup key={sectionKey}>
                <FormField
                  control={form.control}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={`${sectionKey}.enabled` as any}
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{sectionInfo.title}</FormLabel>
                        <FormDescription>
                          {sectionInfo.description}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <SettingsControlChildren className='grid gap-3 md:grid-cols-2'>
                  {modules.map(([moduleKey]) => {
                    const moduleInfo = moduleMeta[sectionKey]?.[moduleKey] ?? {
                      title: toTitleCase(moduleKey),
                      description: t('Custom module'),
                    }
                    return (
                      <Fragment key={`${sectionKey}.${moduleKey}`}>
                        <FormField
                          control={form.control}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`${sectionKey}.${moduleKey}` as any}
                          render={({ field }) => (
                            <SettingsSwitchItem className='border-b-0 py-2'>
                              <SettingsSwitchContent>
                                <FormLabel>{moduleInfo.title}</FormLabel>
                                <FormDescription>
                                  {moduleInfo.description}
                                </FormDescription>
                              </SettingsSwitchContent>
                              <FormControl>
                                <Switch
                                  checked={Boolean(field.value)}
                                  onCheckedChange={field.onChange}
                                  disabled={
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    !form.watch(`${sectionKey}.enabled` as any)
                                  }
                                />
                              </FormControl>
                            </SettingsSwitchItem>
                          )}
                        />
                        {sectionKey === 'chat' && moduleKey === 'playground' ? (
                          <FormItem className='md:col-span-2'>
                            <FormLabel>
                              {t('Playground default model')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={currentPlaygroundDefaultModel}
                                onChange={(event) =>
                                  setCurrentPlaygroundDefaultModel(
                                    event.target.value
                                  )
                                }
                                placeholder='gpt-4o'
                                disabled={
                                  !form.watch('chat.enabled') ||
                                  !form.watch('chat.playground')
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Used as the initial model for first-run Playground onboarding.'
                              )}
                            </FormDescription>
                          </FormItem>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </SettingsControlChildren>
              </SettingsControlGroup>
            )
          })}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
