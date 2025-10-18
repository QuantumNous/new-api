import { useEffect, useRef, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'
import { ChatSettingsVisualEditor } from './chat-settings-visual-editor'
import { formatJsonForEditor, normalizeJsonString } from './utils'

const chatSchema = z.object({
  Chats: z.string().superRefine((value, ctx) => {
    try {
      const parsed = JSON.parse(value || '[]')
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Expected a JSON array.',
        })
        return
      }
      for (const item of parsed) {
        if (typeof item !== 'object' || Array.isArray(item)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Each item must be an object with a single key-value pair.',
          })
          return
        }
        const entries = Object.entries(item)
        if (entries.length !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each item must have exactly one key-value pair.',
          })
          return
        }
      }
    } catch (error: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error?.message || 'Invalid JSON string.',
      })
    }
  }),
})

type ChatSettingsFormValues = z.infer<typeof chatSchema>

type ChatSettingsSectionProps = {
  defaultValue: string
}

export function ChatSettingsSection({
  defaultValue,
}: ChatSettingsSectionProps) {
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')

  const formatted = formatJsonForEditor(defaultValue, '[]')
  const form = useForm<ChatSettingsFormValues>({
    resolver: zodResolver(chatSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      Chats: formatted,
    },
  })

  const initialNormalizedRef = useRef(normalizeJsonString(defaultValue, '[]'))

  useEffect(() => {
    form.reset({ Chats: formatJsonForEditor(defaultValue, '[]') })
    initialNormalizedRef.current = normalizeJsonString(defaultValue, '[]')
  }, [defaultValue, form])

  const onSubmit = async (values: ChatSettingsFormValues) => {
    const normalized = normalizeJsonString(values.Chats, '[]')
    if (normalized === initialNormalizedRef.current) {
      return
    }

    await updateOption.mutateAsync({
      key: 'Chats',
      value: normalized,
    })
  }

  return (
    <SettingsAccordion
      value='chat-settings'
      title='Chat Presets'
      description='Configure predefined chat links surfaced to end users.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <Tabs
            value={editMode}
            onValueChange={(value) => setEditMode(value as 'visual' | 'json')}
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='visual'>Visual</TabsTrigger>
              <TabsTrigger value='json'>JSON</TabsTrigger>
            </TabsList>

            <TabsContent value='visual' className='mt-6'>
              <FormField
                control={form.control}
                name='Chats'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ChatSettingsVisualEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value='json' className='mt-6'>
              <FormField
                control={form.control}
                name='Chats'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chat configuration JSON</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={12}
                        placeholder='[{"ChatGPT":"https://chat.openai.com"},{"Lobe Chat":"https://chat-preview.lobehub.com/?settings={...}"}]'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Array of chat client presets. Each item is an object with
                      one key-value pair: client name and its URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save chat settings'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
