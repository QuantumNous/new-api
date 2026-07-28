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
import {
  Code,
  FileText,
  RefreshCw,
  Route,
  Settings,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { sideDrawerSectionClassName } from '@/components/drawer-layout'
import { JsonEditor } from '@/components/json-editor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  FIELD_DESCRIPTIONS,
  FIELD_PLACEHOLDERS,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import type { ChannelFormValues } from '../../lib'
import { CardHeading, SubHeading } from './channel-editor-shared'
import {
  ADVANCED_SETTINGS_SECTION_IDS,
  configuredAdvancedSectionClassName,
  formatUnixTime,
} from './channel-editor-utils'
import { ChannelAdvancedSection } from './sections'

type ChannelAdvancedSettingsProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary?: ReactNode
  currentType: number
  sensitiveLocked: boolean
  isSubmitting: boolean
  routingStrategyConfigured: boolean
  internalNotesConfigured: boolean
  overrideRulesConfigured: boolean
  extraSettingsConfigured: boolean
  fieldPassthroughConfigured: boolean
  upstreamModelDetectionConfigured: boolean
  upstreamModelUpdateCheckEnabled: boolean | undefined
  upstreamUpdateMeta: {
    lastCheckTime: unknown
    detectedModels: string[]
  }
  upstreamDetectedModelsPreview: string[]
  upstreamDetectedModelsOmittedCount: number
  onOpenParamOverrideEditor: () => void
}

export function ChannelAdvancedSettings(props: ChannelAdvancedSettingsProps) {
  const { t } = useTranslation()
  const form = useFormContext<ChannelFormValues>()
  const currentType = props.currentType

  return (
    <ChannelAdvancedSection
      open={props.open}
      onOpenChange={props.onOpenChange}
      summary={props.summary}
    >
      {/* ── Routing & Overrides ── */}
      <div className={sideDrawerSectionClassName()}>
        <CardHeading
          title={t('Routing & Overrides')}
          icon={<Route className='h-4 w-4' />}
          iconTone='info'
        />
        <div
          id={ADVANCED_SETTINGS_SECTION_IDS.routingStrategy}
          className={configuredAdvancedSectionClassName(
            'flex scroll-mt-4 flex-col gap-4',
            props.routingStrategyConfigured
          )}
        >
          <SubHeading
            title={t('Routing Strategy')}
            icon={<Route className='h-3.5 w-3.5' />}
            iconTone='info'
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Priority')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      placeholder='0'
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(FIELD_DESCRIPTIONS.PRIORITY)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='weight'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Weight')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      placeholder='0'
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(FIELD_DESCRIPTIONS.WEIGHT)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='test_model'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Test Model')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t(FIELD_PLACEHOLDERS.TEST_MODEL)}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(FIELD_DESCRIPTIONS.TEST_MODEL)}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='auto_ban'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Auto Ban')}</FormLabel>
                  <FormDescription>
                    {t(FIELD_DESCRIPTIONS.AUTO_BAN)}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === 1}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? 1 : 0)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div
          id={ADVANCED_SETTINGS_SECTION_IDS.internalNotes}
          className={configuredAdvancedSectionClassName(
            'flex scroll-mt-4 flex-col gap-4 border-t pt-4',
            props.internalNotesConfigured
          )}
        >
          <SubHeading
            title={t('Internal Notes')}
            icon={<FileText className='h-3.5 w-3.5' />}
            iconTone='chart-3'
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='tag'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Tag')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t(FIELD_PLACEHOLDERS.TAG)} {...field} />
                  </FormControl>
                  <FormDescription>{t(FIELD_DESCRIPTIONS.TAG)}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='remark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Remark')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t(FIELD_PLACEHOLDERS.REMARK)}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(FIELD_DESCRIPTIONS.REMARK)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div
          id={ADVANCED_SETTINGS_SECTION_IDS.overrideRules}
          className={configuredAdvancedSectionClassName(
            'flex scroll-mt-4 flex-col gap-4 border-t pt-4',
            props.overrideRulesConfigured
          )}
        >
          <SubHeading
            title={t('Override Rules')}
            icon={<Code className='h-3.5 w-3.5' />}
            iconTone='chart-4'
          />

          <FormField
            control={form.control}
            name='status_code_mapping'
            render={({ field }) => (
              <FormItem className='space-y-3'>
                <div className='space-y-1'>
                  <FormLabel>{t('Status Code Mapping')}</FormLabel>
                  <FormDescription>
                    {t('Map upstream status codes to different codes')}
                  </FormDescription>
                </div>
                <FormControl>
                  <JsonEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={props.isSubmitting}
                    keyPlaceholder='400'
                    valuePlaceholder='500'
                    keyLabel='Original Code'
                    valueLabel='Mapped Code'
                    emptyMessage={t('No status code mappings configured.')}
                    template={{ '400': '500', '429': '503' }}
                    valueType='string'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {props.sensitiveLocked && (
            <p className='text-muted-foreground text-xs'>
              {t('No permission to perform this action')}
            </p>
          )}
          <fieldset
            disabled={props.sensitiveLocked}
            className='space-y-4 disabled:opacity-60'
          >
            <FormField
              control={form.control}
              name='param_override'
              render={({ field }) => (
                <FormItem className='space-y-3 border-t pt-4'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-1'>
                      <FormLabel>{t('Parameter Override')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Override request parameters. Cannot override stream parameter.'
                        )}
                      </FormDescription>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={props.onOpenParamOverrideEditor}
                      >
                        <Wand2 className='mr-2 h-4 w-4' />
                        {t('Visual edit')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          field.onChange(
                            JSON.stringify(
                              {
                                operations: [
                                  {
                                    path: 'temperature',
                                    mode: 'set',
                                    value: 0.7,
                                    conditions: [
                                      {
                                        path: 'model',
                                        mode: 'prefix',
                                        value: 'gpt',
                                      },
                                    ],
                                    logic: 'AND',
                                  },
                                ],
                              },
                              null,
                              2
                            )
                          )
                        }}
                      >
                        <Code className='mr-2 h-4 w-4' />
                        {t('New Format Template')}
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => field.onChange('')}
                      >
                        {t('Clear')}
                      </Button>
                    </div>
                  </div>
                  <FormControl>
                    <Textarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={props.sensitiveLocked || props.isSubmitting}
                      rows={8}
                      placeholder={t(
                        'Override request parameters. Cannot override stream parameter.'
                      )}
                      className='max-h-72 min-h-40 resize-y overflow-auto font-mono text-xs'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='header_override'
              render={({ field }) => (
                <FormItem className='space-y-3 border-t pt-4'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-1'>
                      <FormLabel>{t('Request Header Override')}</FormLabel>
                      <FormDescription>
                        {t('Override request headers')}
                      </FormDescription>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          field.onChange(
                            JSON.stringify(
                              {
                                '*': true,
                                're:^X-Trace-.*$': true,
                                'X-Foo': '{client_header:X-Foo}',
                                Authorization: 'Bearer {api_key}',
                              },
                              null,
                              2
                            )
                          )
                        }
                      >
                        {t('Fill Template')}
                      </Button>

                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          field.onChange(JSON.stringify({ '*': true }, null, 2))
                        }
                      >
                        {t('Passthrough Template')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(field.value || '{}')
                            field.onChange(JSON.stringify(parsed, null, 2))
                          } catch {
                            /* ignore invalid JSON */
                          }
                        }}
                      >
                        {t('Format')}
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => field.onChange('')}
                      >
                        {t('Clear')}
                      </Button>
                    </div>
                  </div>
                  <FormControl>
                    <Textarea
                      className='font-mono text-sm'
                      rows={6}
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={props.sensitiveLocked || props.isSubmitting}
                      placeholder={t('Enter JSON to override request headers')}
                    />
                  </FormControl>
                  <FormDescription className='text-xs'>
                    {t('Supported variables')}:{' '}
                    <code className='bg-muted rounded px-1 py-0.5'>
                      {'{api_key}'}
                    </code>{' '}
                    — {t('Channel key')},{' '}
                    <code className='bg-muted rounded px-1 py-0.5'>
                      {'{client_header:NAME}'}
                    </code>{' '}
                    — {t('Client header value')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </div>
      </div>

      {/* ── Extra Settings ── */}
      <div
        id={ADVANCED_SETTINGS_SECTION_IDS.extraSettings}
        className={sideDrawerSectionClassName(
          configuredAdvancedSectionClassName(
            'scroll-mt-4',
            props.extraSettingsConfigured
          )
        )}
      >
        <CardHeading
          title={t('Channel Extra Settings')}
          icon={<Settings className='h-4 w-4' />}
          iconTone='chart-3'
        />
        {props.sensitiveLocked && (
          <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
            <AlertDescription>
              {t('No permission to perform this action')}
            </AlertDescription>
          </Alert>
        )}
        <fieldset
          disabled={props.sensitiveLocked}
          className='space-y-4 disabled:opacity-60'
        >
          <div className='divide-border space-y-0 divide-y border-y'>
            {currentType === 1 && (
              <FormField
                control={form.control}
                name='force_format'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between px-4 py-3'>
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Force Format')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Force format response to OpenAI standard (OpenAI channel only)'
                        )}
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
            )}

            <FormField
              control={form.control}
              name='thinking_to_content'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between px-4 py-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Thinking to Content')}</FormLabel>
                    <FormDescription>
                      {t('Convert reasoning_content to <think> tag in content')}
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
              name='pass_through_body_enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between px-4 py-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Pass Through Body')}</FormLabel>
                    <FormDescription>
                      {t('Pass request body directly to upstream')}
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
              name='disable_task_polling_sleep'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between px-4 py-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Skip async task polling delay')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Do not wait one second between polling async tasks for this channel'
                      )}
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
          </div>

          <FormField
            control={form.control}
            name='proxy'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Proxy Address')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('socks5://user:pass@host:port')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Network proxy for this channel (supports socks5 protocol)'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='system_prompt'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('System Prompt')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t(
                      'Enter system prompt (user prompt takes priority)'
                    )}
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Default system prompt for this channel')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='system_prompt_override'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('System Prompt Concatenation')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Concatenate channel system prompt with user&apos;s prompt'
                    )}
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
        </fieldset>
      </div>

      {(currentType === 1 || currentType === 14 || currentType === 57) && (
        <div
          id={ADVANCED_SETTINGS_SECTION_IDS.fieldPassthrough}
          className={sideDrawerSectionClassName(
            configuredAdvancedSectionClassName(
              'scroll-mt-4',
              props.fieldPassthroughConfigured
            )
          )}
        >
          <CardHeading
            title={t('Field passthrough controls')}
            icon={<SlidersHorizontal className='h-4 w-4' />}
            iconTone='chart-4'
          />
          <fieldset
            disabled={props.sensitiveLocked}
            className='disabled:opacity-60'
          >
            <div className='divide-border space-y-0 divide-y border-y'>
              <FormField
                control={form.control}
                name='allow_service_tier'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-sm'>
                        {t('Allow service_tier passthrough')}
                      </FormLabel>
                      <FormDescription>
                        {t('Pass through the service_tier field')}
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

              {(currentType === 1 || currentType === 57) && (
                <>
                  <FormField
                    control={form.control}
                    name='disable_store'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Disable store passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t('When enabled, the store field will be blocked')}
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
                    name='allow_safety_identifier'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow safety_identifier passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t('Pass through the safety_identifier field')}
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
                    name='allow_include_obfuscation'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow include usage obfuscation passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              'Pass through the include field for usage obfuscation'
                            )}
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
                    name='allow_inference_geo'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow inference geography passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              'Pass through the inference_geo field for geographic routing'
                            )}
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
                </>
              )}

              {currentType === 14 && (
                <>
                  <FormField
                    control={form.control}
                    name='allow_inference_geo'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow inference_geo passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              'Pass through the inference_geo field for Claude data residency region control'
                            )}
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
                    name='allow_speed'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow speed passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              'Pass through the speed field for Claude inference speed mode control'
                            )}
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
                    name='claude_beta_query'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Allow Claude beta query passthrough')}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              'Pass through the anthropic-beta header for beta features'
                            )}
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
                </>
              )}
            </div>
          </fieldset>
        </div>
      )}

      {MODEL_FETCHABLE_TYPES.has(currentType) && (
        <div
          id={ADVANCED_SETTINGS_SECTION_IDS.upstreamModelDetection}
          className={sideDrawerSectionClassName(
            configuredAdvancedSectionClassName(
              'scroll-mt-4',
              props.upstreamModelDetectionConfigured
            )
          )}
        >
          <CardHeading
            title={t('Upstream Model Detection Settings')}
            icon={<RefreshCw className='h-4 w-4' />}
            iconTone='info'
          />
          <fieldset
            disabled={props.sensitiveLocked}
            className='space-y-4 disabled:opacity-60'
          >
            <div className='divide-border space-y-0 divide-y border-y'>
              <FormField
                control={form.control}
                name='upstream_model_update_check_enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between px-4 py-3'>
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Upstream Model Update Check')}</FormLabel>
                      <FormDescription>
                        {t('Periodically check for upstream model changes')}
                      </FormDescription>
                      <FormMessage />
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
                name='upstream_model_update_auto_sync_enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between px-4 py-3'>
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Auto Sync Upstream Models')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Automatically sync model list when upstream changes are detected'
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        disabled={!props.upstreamModelUpdateCheckEnabled}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='upstream_model_update_ignored_models'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Ignored upstream models')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        'e.g., gpt-4.1-nano,regex:^claude-.*$,regex:^sora-.*$'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Comma-separated exact model names. Prefix with regex: to ignore by regular expression.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='text-muted-foreground space-y-2 border-t pt-3 text-xs'>
              <div>
                <span className='text-foreground font-medium'>
                  {t('Last check time')}:
                </span>{' '}
                {formatUnixTime(props.upstreamUpdateMeta.lastCheckTime)}
              </div>
              <div>
                <span className='text-foreground font-medium'>
                  {t('Last detected addable models')}:
                </span>{' '}
                {props.upstreamUpdateMeta.detectedModels.length === 0 ? (
                  t('None')
                ) : (
                  <>
                    <span className='break-all'>
                      {props.upstreamDetectedModelsPreview.join(', ')}
                    </span>
                    {props.upstreamDetectedModelsOmittedCount > 0 && (
                      <span className='ml-1'>
                        {t('({{total}} total, {{omit}} omitted)', {
                          total: props.upstreamUpdateMeta.detectedModels.length,
                          omit: props.upstreamDetectedModelsOmittedCount,
                        })}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </ChannelAdvancedSection>
  )
}
