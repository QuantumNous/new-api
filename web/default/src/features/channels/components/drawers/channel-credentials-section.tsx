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
import { Copy, Eye, Loader2, RefreshCw, Route, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  CHANNEL_TYPE_WARNINGS,
  FIELD_DESCRIPTIONS,
  FIELD_PLACEHOLDERS,
} from '../../constants'
import {
  CHANNEL_TYPE_ADVANCED_CUSTOM,
  type getAdvancedCustomStats,
  getKeyPromptForType,
  type ChannelFormValues,
} from '../../lib'
import { ChannelApiAccessSection, ChannelAuthSection } from './sections'

type ChannelCredentialsSectionProps = {
  sensitiveLocked: boolean
  isEditing: boolean
  isBatchMode: boolean
  currentType: number
  channelId: number | null
  vertexKeyType: string | undefined
  awsKeyType: string | undefined
  keyMode: string | undefined
  multiKeyMode: string | undefined
  multiKeyType: string | undefined
  isMultiKeyChannel: boolean
  canRevealChannelKey: boolean
  channelKey: string | null
  isChannelKeyLoading: boolean
  verificationLoading: boolean
  doubaoApiEditUnlocked: boolean
  isCodexCredentialRefreshing: boolean
  advancedCustomStats: ReturnType<typeof getAdvancedCustomStats>
  advancedCustomRouteTypeLabels: string[]
  hiddenAdvancedCustomRouteTypeCount: number
  advancedCustomRouteTypeTitle: string | undefined
  addModeOptions: ReadonlyArray<{ value: string; label: string }>
  onApiConfigSecretClick: () => void
  onOpenAdvancedCustomEditor: () => void
  onDeduplicateKeys: () => void
  onRevealKey: () => void
  onCopyKey: (value: string) => unknown
  onRefreshCodexCredential: () => void
}

export function ChannelCredentialsSection(
  props: ChannelCredentialsSectionProps
) {
  const { t } = useTranslation()
  const form = useFormContext<ChannelFormValues>()
  const currentType = props.currentType
  const isGatewayChannel = currentType === 59 || currentType === 60

  return (
    <ChannelApiAccessSection>
      {CHANNEL_TYPE_WARNINGS[currentType] && (
        <Alert>
          <AlertDescription>
            {t(CHANNEL_TYPE_WARNINGS[currentType])}
          </AlertDescription>
        </Alert>
      )}

      {props.sensitiveLocked && (
        <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
          <AlertDescription>
            {t('No permission to perform this action')}
          </AlertDescription>
        </Alert>
      )}

      {isGatewayChannel && (
        <Alert>
          <AlertDescription className='space-y-3'>
            <p>
              {currentType === 59
                ? t(
                    "Connects to a user-managed Sub2API upstream. Use the API key issued by that upstream; platform administrator credentials are never used."
                  )
                : t(
                    "Connects to a New API-compatible upstream with native multi-protocol routing. Use an API key created by that upstream."
                  )}
            </p>
            <div className='flex flex-wrap gap-2'>
              {[
                'OpenAI Chat',
                'Responses',
                'Compact',
                'Claude',
                'Gemini',
                'Alpha Search',
              ].map((protocol) => (
                <Badge key={protocol} variant='secondary'>
                  {protocol}
                </Badge>
              ))}
            </div>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Available protocols and models depend on the upstream deployment. You can fetch its model list after saving the channel.'
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className='border-border/60 bg-muted/10 rounded-lg border p-4'>
        <fieldset
          disabled={props.sensitiveLocked}
          className='space-y-4 disabled:opacity-60'
        >
          {/* Azure (type 3) */}
          {currentType === 3 && (
            <>
              <FormField
                control={form.control}
                name='base_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('AZURE_OPENAI_ENDPOINT *')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          'e.g., https://docs-test-001.openai.azure.com'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Your Azure OpenAI endpoint URL')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='other'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Default API Version *')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('e.g., 2025-04-01-preview')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Default API version for this channel')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='azure_responses_version'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Responses API Version')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('e.g., preview')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Default Responses API version, if empty, will use the API version above'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Custom (type 8) */}
          {currentType === 8 && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Full Base URL (supports')} {'{'}
                    {t('model')}
                    {'}'} {t('variable) *')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        'e.g., https://api.openai.com/v1/chat/completions'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Enter the complete URL, supports')} {'{'}
                    {t('model')}
                    {'}'} {t('variable')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Xunfei/Spark (type 18) */}
          {currentType === 18 && (
            <FormField
              control={form.control}
              name='other'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model Version *')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g., v2.1')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Spark model version, e.g., v2.1 (version number in API URL)'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* OpenRouter (type 20) */}
          {currentType === 20 && (
            <FormField
              control={form.control}
              name='is_enterprise_account'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Enterprise Account')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Enable if this is an OpenRouter enterprise account with special response format'
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

          {/* AWS (type 33) */}
          {currentType === 33 && (
            <FormField
              control={form.control}
              name='aws_key_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('AWS Key Format')}</FormLabel>
                  <Select
                    items={[
                      {
                        value: 'ak_sk',
                        label: t('AccessKey / SecretAccessKey'),
                      },
                      {
                        value: 'api_key',
                        label: t('API Key'),
                      },
                    ]}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select key format')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='ak_sk'>
                          {t('AccessKey / SecretAccessKey')}
                        </SelectItem>
                        <SelectItem value='api_key'>{t('API Key')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'api_key'
                      ? t('API Key mode: use APIKey|Region')
                      : t('AK/SK mode: use AccessKey|SecretAccessKey|Region')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* AI Proxy Library (type 21) */}
          {currentType === 21 && (
            <FormField
              control={form.control}
              name='other'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Knowledge Base ID *')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g., 123456')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Enter the knowledge base ID')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* FastGPT (type 22) */}
          {currentType === 22 && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Private Deployment URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., https://fastgpt.run/api/openapi')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'For private deployments, format: https://fastgpt.run/api/openapi'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* SunoAPI (type 36) */}
          {currentType === 36 && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('API Base URL (Important: Not Chat API) *')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        'e.g., https://api.example.com (path before /suno)'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Enter the path before /suno, usually just the domain')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Cloudflare Workers AI (type 39) */}
          {currentType === 39 && (
            <FormField
              control={form.control}
              name='other'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Account ID *')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., d6b5da8hk1awo8nap34ube6gh')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Your Cloudflare Account ID')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* SiliconFlow (type 40) */}
          {currentType === 40 && (
            <Alert>
              <AlertDescription>
                {t('Referral link:')}{' '}
                <a
                  href='https://cloud.siliconflow.cn/i/hij0YNTZ'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary underline'
                >
                  {t('https://cloud.siliconflow.cn/i/hij0YNTZ')}
                </a>
              </AlertDescription>
            </Alert>
          )}

          {/* Vertex AI (type 41) */}
          {currentType === 41 && (
            <>
              <FormField
                control={form.control}
                name='vertex_key_type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Vertex AI Key Format')}</FormLabel>
                    <Select
                      items={[
                        { value: 'json', label: t('JSON') },
                        {
                          value: 'api_key',
                          label: t('API Key'),
                        },
                      ]}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='json'>{t('JSON')}</SelectItem>
                          <SelectItem value='api_key'>
                            {t('API Key')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'json'
                        ? t('JSON format supports service account JSON files')
                        : t('API Key mode (does not support batch creation)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {props.vertexKeyType === 'json' && (
                <FormItem>
                  <FormLabel>{t('Service account JSON file(s)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='file'
                      accept='.json,application/json'
                      multiple={props.isBatchMode}
                      onChange={async (e) => {
                        const fileList = e.target.files
                        const files = fileList ? [...fileList] : []
                        // allow re-selecting the same file
                        e.target.value = ''

                        if (files.length === 0) {
                          toast.info(t('Please upload key file(s)'))
                          return
                        }

                        const keys: unknown[] = []
                        for (const file of files) {
                          try {
                            const txt = await file.text()
                            keys.push(JSON.parse(txt))
                          } catch {
                            toast.error(
                              t('Failed to parse JSON file: {{name}}', {
                                name: file.name,
                              })
                            )
                            return
                          }
                        }

                        if (keys.length === 0) {
                          toast.info(t('Please upload key file(s)'))
                          return
                        }

                        const keyValue = props.isBatchMode
                          ? JSON.stringify(keys)
                          : JSON.stringify(keys[0])

                        form.setValue('key', keyValue, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })

                        toast.success(
                          t('Parsed {{count}} service account file(s)', {
                            count: keys.length,
                          })
                        )
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {props.isBatchMode
                      ? t('Upload multiple JSON files in batch modes')
                      : t('Upload a single service account JSON file')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
              <FormField
                control={form.control}
                name='other'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Deployment Region *')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'e.g., us-central1 or JSON format for model-specific regions'
                        )}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Enter deployment region or JSON mapping:')} {'{'}
                      {t(
                        '"default": "us-central1", "claude-3-5-sonnet-20240620": "europe-west1"'
                      )}
                      {'}'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* VolcEngine (type 45) */}
          {currentType === 45 && !props.doubaoApiEditUnlocked && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className='cursor-pointer select-none'
                    onClick={props.onApiConfigSecretClick}
                  >
                    {t('API Base URL *')}
                  </FormLabel>
                  <Select
                    items={[
                      {
                        value: 'https://ark.cn-beijing.volces.com',
                        label: t('https://ark.cn-beijing.volces.com'),
                      },
                      {
                        value: 'https://ark.ap-southeast.bytepluses.com',
                        label: t('https://ark.ap-southeast.bytepluses.com'),
                      },
                    ]}
                    onValueChange={field.onChange}
                    value={
                      field.value === 'doubao-coding-plan'
                        ? 'https://ark.cn-beijing.volces.com'
                        : field.value || 'https://ark.cn-beijing.volces.com'
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='https://ark.cn-beijing.volces.com'>
                          {t('https://ark.cn-beijing.volces.com')}
                        </SelectItem>
                        <SelectItem value='https://ark.ap-southeast.bytepluses.com'>
                          {t('https://ark.ap-southeast.bytepluses.com')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Select the API endpoint region')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* VolcEngine (type 45) - Custom API URL (unlocked) */}
          {currentType === 45 && props.doubaoApiEditUnlocked && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('API Base URL *')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., https://ark.cn-beijing.volces.com')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Enter custom API endpoint URL')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Coze (type 49) */}
          {currentType === 49 && (
            <FormField
              control={form.control}
              name='other'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Agent ID *')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g., 7342866812345')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Enter the Coze agent ID')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {isGatewayChannel && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Upstream Base URL *')}</FormLabel>
                  <FormControl>
                    <Input placeholder='https://gateway.example.com' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Enter the upstream site origin or deployment base path. Do not add /v1, endpoint paths, query parameters, or a trailing slash.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* General base_url for other types */}
          {![3, 8, 22, 36, 45, 59, 60].includes(currentType) && (
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Base URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(FIELD_PLACEHOLDERS.BASE_URL)}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Custom API base URL. For official channels, New API has built-in addresses. Only fill this for third-party proxy sites or special endpoints. Do not add /v1 or trailing slash.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {currentType === CHANNEL_TYPE_ADVANCED_CUSTOM && (
            <FormField
              control={form.control}
              name='advanced_custom'
              render={({ field }) => (
                <FormItem className='space-y-3 border-y py-4'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2'>
                      <FormLabel>{t('Advanced Custom Routes')}</FormLabel>
                      <div className='flex flex-wrap gap-2'>
                        <Badge variant='secondary'>
                          {t('Routes')}: {props.advancedCustomStats.routeCount}
                        </Badge>
                        {props.advancedCustomRouteTypeLabels.map((label) => (
                          <Badge
                            key={label}
                            variant='outline'
                            className='max-w-[12rem]'
                            title={label}
                          >
                            <span className='truncate'>{label}</span>
                          </Badge>
                        ))}
                        {props.hiddenAdvancedCustomRouteTypeCount > 0 && (
                          <Badge
                            variant='outline'
                            title={props.advancedCustomRouteTypeTitle}
                          >
                            +{props.hiddenAdvancedCustomRouteTypeCount}
                          </Badge>
                        )}
                        {!props.advancedCustomStats.valid && (
                          <Badge variant='destructive'>{t('Incomplete')}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={props.onOpenAdvancedCustomEditor}
                    >
                      <Route className='mr-2 h-4 w-4' />
                      {t('Configure routes')}
                    </Button>
                  </div>
                  <FormControl>
                    <input type='hidden' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <ChannelAuthSection>
            {!props.isEditing && (
              <FormField
                control={form.control}
                name='multi_key_mode'
                render={({ field }) => (
                  <FormItem className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <FormLabel className='text-muted-foreground text-xs font-medium'>
                      {t('Add Mode')}
                    </FormLabel>
                    <Select
                      items={props.addModeOptions.map((option) => ({
                        value: option.value,
                        label: t(option.label),
                      }))}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger size='sm' className='w-full sm:w-56'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {props.addModeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.label)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='key'
              render={({ field }) => {
                let keyPlaceholder = t(getKeyPromptForType(currentType))
                if (props.isEditing) {
                  keyPlaceholder = t('Leave empty to keep existing key')
                } else if (
                  currentType === 33 &&
                  props.awsKeyType === 'api_key' &&
                  props.isBatchMode
                ) {
                  keyPlaceholder = t(
                    'Enter API Key, one per line, format: APIKey|Region'
                  )
                } else if (
                  currentType === 33 &&
                  props.awsKeyType === 'api_key'
                ) {
                  keyPlaceholder = t('Enter API Key, format: APIKey|Region')
                } else if (currentType === 33 && props.isBatchMode) {
                  keyPlaceholder = t(
                    'Enter key, one per line, format: AccessKey|SecretAccessKey|Region'
                  )
                } else if (currentType === 33) {
                  keyPlaceholder = t(
                    'Enter key, format: AccessKey|SecretAccessKey|Region'
                  )
                } else if (props.isBatchMode) {
                  keyPlaceholder = t(
                    'Enter one key per line for batch creation'
                  )
                }

                let keyDescription: ReactNode = t(FIELD_DESCRIPTIONS.KEY)
                if (props.isEditing) {
                  let keyModeDescription = t(
                    'Append mode: New keys will be added to the end of the existing key list'
                  )
                  if (props.keyMode === 'replace') {
                    keyModeDescription = t(
                      'Replace mode: Will completely replace all existing keys'
                    )
                  }
                  keyDescription = (
                    <>
                      {t(
                        'Enter new key to update, or leave empty to keep current key'
                      )}
                      {props.isMultiKeyChannel && (
                        <span className='text-warning mt-1 block'>
                          {keyModeDescription}
                        </span>
                      )}
                    </>
                  )
                } else if (props.isBatchMode) {
                  keyDescription = t(
                    'Enter one API key per line for batch creation'
                  )
                } else if (currentType === 59) {
                  keyDescription = t(
                    'Use the channel API key issued by your Sub2API upstream. Do not enter a platform administrator key.'
                  )
                } else if (currentType === 60) {
                  keyDescription = t(
                    'Use an API key created in the upstream New API deployment.'
                  )
                }
                return (
                  <FormItem>
                    <FormLabel>{t('API Key *')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={keyPlaceholder}
                        rows={props.isBatchMode ? 8 : 4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      <div className='flex flex-col gap-2'>
                        <span>{keyDescription}</span>
                        {props.isBatchMode && (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={props.onDeduplicateKeys}
                            className='w-fit'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            {t('Remove Duplicates')}
                          </Button>
                        )}
                      </div>
                    </FormDescription>
                    {props.isEditing && props.canRevealChannelKey && (
                      <div className='border-border/60 mt-4 flex flex-col gap-3 border-y border-dashed py-4'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                          <div>
                            <p className='text-sm font-medium'>
                              {t('Current key')}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                              {t(
                                'Verification required to reveal the saved key.'
                              )}
                            </p>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={props.onRevealKey}
                              disabled={
                                props.isChannelKeyLoading ||
                                props.verificationLoading
                              }
                            >
                              {props.isChannelKeyLoading ||
                              props.verificationLoading ? (
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                              ) : (
                                <Eye className='mr-2 h-4 w-4' />
                              )}
                              {t('Reveal key')}
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              onClick={async () => {
                                if (props.channelKey) {
                                  await props.onCopyKey(props.channelKey)
                                }
                              }}
                              disabled={!props.channelKey}
                            >
                              <Copy className='mr-2 h-4 w-4' />
                              {t('Copy')}
                            </Button>
                          </div>
                        </div>
                        <Input
                          readOnly
                          value={props.channelKey ?? ''}
                          placeholder={t('Hidden — verify to reveal')}
                          className='font-mono'
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            {currentType === 57 && (
              <div className='border-border/60 flex flex-col gap-3 border-y py-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='text-muted-foreground text-xs'>
                    {t(
                      'Codex channels use an OAuth JSON credential as the key.'
                    )}
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    {props.isEditing && props.channelId && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={props.onRefreshCodexCredential}
                        disabled={
                          props.sensitiveLocked ||
                          props.isCodexCredentialRefreshing
                        }
                      >
                        {props.isCodexCredentialRefreshing ? (
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        ) : (
                          <RefreshCw className='mr-2 h-4 w-4' />
                        )}
                        {props.isCodexCredentialRefreshing
                          ? t('Refreshing...')
                          : t('Refresh credential')}
                      </Button>
                    )}
                  </div>
                </div>
                <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
                  <AlertDescription>
                    {t(
                      "Disclaimer: Personal use only. Do not distribute or share any credentials. This channel has prerequisites and requires prior setup; use it only if you understand the flow and risks, and comply with OpenAI's terms and policies. Credentials and configuration are for Codex CLI integration only, and are not intended for any other client, platform, or channel."
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {props.isEditing && props.isMultiKeyChannel && (
              <FormField
                control={form.control}
                name='key_mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Key Update Mode')}</FormLabel>
                    <Select
                      items={[
                        {
                          value: 'append',
                          label: t('Append to existing keys'),
                        },
                        {
                          value: 'replace',
                          label: t('Replace all existing keys'),
                        },
                      ]}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='append'>
                            {t('Append to existing keys')}
                          </SelectItem>
                          <SelectItem value='replace'>
                            {t('Replace all existing keys')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'replace'
                        ? t(
                            'Replace mode: Will completely replace all existing keys'
                          )
                        : t(
                            'Append mode: New keys will be added to the end of the existing key list'
                          )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!props.isEditing && props.multiKeyMode === 'multi_to_single' && (
              <FormField
                control={form.control}
                name='multi_key_type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Multi-Key Strategy')}</FormLabel>
                    <Select
                      items={[
                        {
                          value: 'random',
                          label: t('Random'),
                        },
                        {
                          value: 'polling',
                          label: t('Polling'),
                        },
                      ]}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='random'>{t('Random')}</SelectItem>
                          <SelectItem value='polling'>
                            {t('Polling')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {props.multiKeyType === 'polling' ? (
                        <span className='text-warning'>
                          {t(
                            'Polling mode requires Redis and memory cache, otherwise performance will be significantly degraded'
                          )}
                        </span>
                      ) : (
                        t(
                          'Randomly select a key from the pool for each request'
                        )
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </ChannelAuthSection>
        </fieldset>
      </div>
    </ChannelApiAccessSection>
  )
}
