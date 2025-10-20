import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createChannel, getChannel, updateChannel } from '../../api'
import {
  ADD_MODE_OPTIONS,
  AUTO_BAN_OPTIONS,
  CHANNEL_TYPE_OPTIONS,
  ERROR_MESSAGES,
  FIELD_DESCRIPTIONS,
  FIELD_PLACEHOLDERS,
  SUCCESS_MESSAGES,
} from '../../constants'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  channelsQueryKeys,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../../lib'
import type { Channel } from '../../types'
import { useChannels } from '../channels-provider'

type ChannelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Channel | null
}

export function ChannelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ChannelMutateDrawerProps) {
  const queryClient = useQueryClient()
  const { setOpen } = useChannels()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = Boolean(currentRow)

  // Fetch channel details if editing
  const { data: channelData } = useQuery({
    queryKey: channelsQueryKeys.detail(currentRow?.id || 0),
    queryFn: () => getChannel(currentRow!.id),
    enabled: isEditing && Boolean(currentRow?.id),
  })

  // Check if this is a multi-key channel
  const isMultiKeyChannel =
    isEditing && channelData?.data?.channel_info?.is_multi_key === true

  // Form setup
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: CHANNEL_FORM_DEFAULT_VALUES,
  })

  // Watch form values for conditional rendering
  const multiKeyMode = form.watch('multi_key_mode')
  const multiKeyType = form.watch('multi_key_type')

  // Load channel data into form when editing
  useEffect(() => {
    if (isEditing && channelData?.data) {
      const defaults = transformChannelToFormDefaults(channelData.data)
      form.reset(defaults)
    } else if (!isEditing) {
      form.reset(CHANNEL_FORM_DEFAULT_VALUES)
    }
  }, [isEditing, channelData, form])

  // Submit handler
  const onSubmit = async (data: ChannelFormValues) => {
    setIsSubmitting(true)
    try {
      if (isEditing && currentRow) {
        // Update existing channel
        let payload = transformFormDataToUpdatePayload(data, currentRow.id)

        // Add key_mode for multi-key channels
        if (isMultiKeyChannel && data.key_mode) {
          payload = {
            ...payload,
            key_mode: data.key_mode,
          } as any
        }

        const response = await updateChannel(currentRow.id, payload)

        if (response.success) {
          toast.success(SUCCESS_MESSAGES.UPDATED)
          queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
          onOpenChange(false)
          setOpen(null)
        }
      } else {
        // Create new channel(s)
        const payload = transformFormDataToCreatePayload(data)
        const response = await createChannel(payload)

        if (response.success) {
          toast.success(SUCCESS_MESSAGES.CREATED)
          queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
          onOpenChange(false)
          setOpen(null)
        }
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || ERROR_MESSAGES.CREATE_FAILED
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent className='flex flex-col sm:max-w-2xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>
            {isEditing ? 'Edit Channel' : 'Create Channel'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update channel configuration and click save when you&apos;re done.'
              : 'Add a new channel by providing the necessary information.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='channel-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 overflow-y-auto px-4'
          >
            {/* Basic Info Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Basic Information</h3>

              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder={FIELD_PLACEHOLDERS.NAME} {...field} />
                    </FormControl>
                    <FormDescription>{FIELD_DESCRIPTIONS.NAME}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select channel type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CHANNEL_TYPE_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{FIELD_DESCRIPTIONS.TYPE}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='base_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={FIELD_PLACEHOLDERS.BASE_URL}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.BASE_URL}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='1'>Enabled</SelectItem>
                        <SelectItem value='0'>Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Authentication Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Authentication</h3>

              {!isEditing && (
                <FormField
                  control={form.control}
                  name='multi_key_mode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Add Mode</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ADD_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.BATCH_ADD}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          isEditing
                            ? 'Leave empty to keep existing key'
                            : multiKeyMode === 'batch' ||
                                multiKeyMode === 'multi_to_single'
                              ? 'Enter one key per line for batch creation'
                              : FIELD_PLACEHOLDERS.KEY
                        }
                        rows={
                          multiKeyMode === 'batch' ||
                          multiKeyMode === 'multi_to_single'
                            ? 8
                            : 4
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditing ? (
                        <>
                          Enter new key to update, or leave empty to keep
                          current key
                          {isMultiKeyChannel && (
                            <span className='text-warning mt-1 block'>
                              Multi-key channel: Keys will be{' '}
                              {form.watch('key_mode') === 'replace'
                                ? 'replaced'
                                : 'appended'}
                            </span>
                          )}
                        </>
                      ) : multiKeyMode === 'batch' ||
                        multiKeyMode === 'multi_to_single' ? (
                        'Enter one API key per line for batch creation'
                      ) : (
                        FIELD_DESCRIPTIONS.KEY
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditing && isMultiKeyChannel && (
                <FormField
                  control={form.control}
                  name='key_mode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Update Mode</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='append'>
                            Append to existing keys
                          </SelectItem>
                          <SelectItem value='replace'>
                            Replace all existing keys
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === 'replace'
                          ? 'Replace mode: Will completely replace all existing keys'
                          : 'Append mode: New keys will be added to the end of the existing key list'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!isEditing && multiKeyMode === 'multi_to_single' && (
                <FormField
                  control={form.control}
                  name='multi_key_type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Multi-Key Strategy</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='random'>Random</SelectItem>
                          <SelectItem value='polling'>Polling</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {multiKeyType === 'polling' ? (
                          <span className='text-warning'>
                            Polling mode requires Redis and memory cache,
                            otherwise performance will be significantly degraded
                          </span>
                        ) : (
                          'Randomly select a key from the pool for each request'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='openai_organization'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAI Organization (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder='org-...' {...field} />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.OPENAI_ORG}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Models & Groups Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Models & Groups</h3>

              <FormField
                control={form.control}
                name='models'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Models *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={FIELD_PLACEHOLDERS.MODELS}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.MODELS}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='group'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Groups *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={FIELD_PLACEHOLDERS.GROUP}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.GROUP}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Advanced Settings Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Advanced Settings</h3>

              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='0'
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.PRIORITY}
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
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='0'
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.WEIGHT}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='test_model'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={FIELD_PLACEHOLDERS.TEST_MODEL}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.TEST_MODEL}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='auto_ban'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto Ban</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AUTO_BAN_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.AUTO_BAN}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='model_mapping'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Mapping (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={FIELD_PLACEHOLDERS.MODEL_MAPPING}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.MODEL_MAPPING}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tag'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag</FormLabel>
                    <FormControl>
                      <Input placeholder={FIELD_PLACEHOLDERS.TAG} {...field} />
                    </FormControl>
                    <FormDescription>{FIELD_DESCRIPTIONS.TAG}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='remark'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remark</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={FIELD_PLACEHOLDERS.REMARK}
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {FIELD_DESCRIPTIONS.REMARK}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status_code_mapping'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Code Mapping (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"400": "500"}'
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Map upstream status codes to different codes (JSON object)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='param_override'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parameter Override (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"temperature": 0.7}'
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Override request parameters (JSON object)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='header_override'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header Override (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"X-Custom-Header": "value"}'
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Override request headers (JSON object)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='max_input_tokens'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Input Tokens</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='0'
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum input tokens allowed (0 for unlimited)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Channel Extra Settings Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Channel Extra Settings</h3>

              {form.watch('type') === 1 && (
                <FormField
                  control={form.control}
                  name='force_format'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Force Format
                        </FormLabel>
                        <FormDescription>
                          Force format response to OpenAI standard (OpenAI
                          channel only)
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
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        Thinking to Content
                      </FormLabel>
                      <FormDescription>
                        Convert reasoning_content to &lt;think&gt; tag in
                        content
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
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        Pass Through Body
                      </FormLabel>
                      <FormDescription>
                        Pass request body directly to upstream
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
                name='proxy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proxy Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='socks5://user:pass@host:port'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Network proxy for this channel (supports socks5 protocol)
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
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Enter system prompt (user prompt takes priority)'
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Default system prompt for this channel
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='system_prompt_override'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        System Prompt Concatenation
                      </FormLabel>
                      <FormDescription>
                        Concatenate channel system prompt with user&apos;s
                        prompt
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

            <Separator />

            {/* Type-Specific Settings Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Type-Specific Settings</h3>

              {form.watch('type') === 20 && (
                <FormField
                  control={form.control}
                  name='is_enterprise_account'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Enterprise Account
                        </FormLabel>
                        <FormDescription>
                          Enable if this is an OpenRouter enterprise account
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

              {form.watch('type') === 41 && (
                <FormField
                  control={form.control}
                  name='vertex_key_type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vertex AI Key Format</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='json'>JSON</SelectItem>
                          <SelectItem value='api_key'>API Key</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === 'json'
                          ? 'JSON format supports service account JSON files'
                          : 'API Key mode (does not support batch creation)'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Show message if no type-specific settings */}
              {form.watch('type') !== 20 && form.watch('type') !== 41 && (
                <p className='text-muted-foreground text-sm'>
                  No type-specific settings for this channel type.
                </p>
              )}
            </div>
          </form>
        </Form>

        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline' disabled={isSubmitting}>
              Cancel
            </Button>
          </SheetClose>
          <Button form='channel-form' type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? 'Update Channel' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
