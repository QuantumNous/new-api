import { useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsAccordion } from '../components/settings-accordion'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const systemInfoSchema = z.object({
  Notice: z.string().optional(),
  SystemName: z.string().min(1, 'System name is required'),
  Logo: z.string().url().optional().or(z.literal('')),
  Footer: z.string().optional(),
  About: z.string().optional(),
  HomePageContent: z.string().optional(),
  'legal.user_agreement': z.string().optional(),
  'legal.privacy_policy': z.string().optional(),
})

type SystemInfoFormValues = z.infer<typeof systemInfoSchema>

type SystemInfoSectionProps = {
  defaultValues: SystemInfoFormValues
}

const OPTION_KEYS = [
  'Notice',
  'SystemName',
  'Logo',
  'Footer',
  'About',
  'HomePageContent',
  'legal.user_agreement',
  'legal.privacy_policy',
] as const

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

function getPathValue(
  source: Record<string, any> | undefined,
  path: string
): unknown {
  if (!source) return undefined
  if (Object.prototype.hasOwnProperty.call(source, path)) {
    return source[path]
  }

  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown> | undefined)?.[segment]
    }
    return undefined
  }, source)
}

function setPathValue(
  target: Record<string, any>,
  path: string,
  value: unknown
) {
  if (!target) return

  target[path] = value

  const segments = path.split('.')
  let current: Record<string, any> = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }

    const next = current[segment]
    current[segment] = next && typeof next === 'object' ? { ...next } : {}
    current = current[segment]
  })
}

export function SystemInfoSection({ defaultValues }: SystemInfoSectionProps) {
  const updateOption = useUpdateOption()

  const normalizedDefaults = useMemo(() => {
    const normalized: Record<string, any> = {}

    OPTION_KEYS.forEach((key) => {
      const rawValue = getPathValue(defaultValues as Record<string, any>, key)
      setPathValue(normalized, key, normalizeValue(rawValue))
    })

    return normalized as SystemInfoFormValues
  }, [defaultValues])

  const form = useForm<SystemInfoFormValues>({
    resolver: zodResolver(systemInfoSchema),
    defaultValues: normalizedDefaults,
  })

  useResetForm(form, normalizedDefaults)

  const onSubmit = async (_data: SystemInfoFormValues) => {
    const baseline =
      (form.formState.defaultValues as Record<string, any> | undefined) ??
      (normalizedDefaults as Record<string, any>)

    const updates = OPTION_KEYS.reduce<Array<[string, string]>>((acc, key) => {
      const currentValue = normalizeValue(form.getValues(key as any))
      const defaultValue = normalizeValue(getPathValue(baseline, key))

      if (currentValue !== defaultValue) {
        acc.push([key, currentValue])
      }

      return acc
    }, [])

    if (updates.length === 0) {
      toast.info('No changes to save')
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }

    const nextDefaults = JSON.parse(
      JSON.stringify(baseline ?? normalizedDefaults)
    ) as Record<string, any>

    updates.forEach(([key, value]) => {
      setPathValue(nextDefaults, key, value)
    })

    form.reset(nextDefaults as SystemInfoFormValues, {
      keepDirty: false,
      keepDirtyValues: false,
      keepErrors: true,
    })
  }

  const handleReset = () => {
    const baseline =
      (form.formState.defaultValues as Record<string, any> | undefined) ??
      (normalizedDefaults as Record<string, any>)

    form.reset(baseline as SystemInfoFormValues, {
      keepDirty: false,
      keepDirtyValues: false,
      keepErrors: false,
    })
    toast.success('Form reset to saved values')
  }

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsAccordion
        value='system-info'
        title='System Information'
        description='Configure basic system information and branding'
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormDirtyIndicator isDirty={form.formState.isDirty} />
            <FormField
              control={form.control}
              name='Notice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notice</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter announcement content (supports Markdown & HTML)'
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Announcement displayed to users (supports Markdown & HTML)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='SystemName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>System Name</FormLabel>
                  <FormControl>
                    <Input placeholder='New API' {...field} />
                  </FormControl>
                  <FormDescription>
                    The name displayed across the application
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='Logo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://example.com/logo.png'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    URL to your logo image (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='Footer'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='© 2025 Your Company. All rights reserved.'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Footer text displayed at the bottom of pages
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='About'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter HTML code (e.g., <p>About us...</p>) or a URL (e.g., https://example.com) to embed as iframe'
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Supports HTML markup or iframe embedding. Enter HTML code
                    directly, or provide a complete URL to automatically embed
                    it as an iframe.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HomePageContent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home Page Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Welcome to our New API...'
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Content displayed on the home page (supports Markdown)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='legal.user_agreement'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Agreement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Provide Markdown, HTML, or an external URL for the user agreement'
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty to disable the agreement requirement. Supports
                    Markdown, HTML, or a full URL to redirect users.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='legal.privacy_policy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Privacy Policy</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Provide Markdown, HTML, or an external URL for the privacy policy'
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty to disable the privacy policy requirement.
                    Supports Markdown, HTML, or a full URL to redirect users.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex gap-2'>
              <Button type='submit' disabled={updateOption.isPending}>
                {updateOption.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={handleReset}
                disabled={!form.formState.isDirty || updateOption.isPending}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reset
              </Button>
            </div>
          </form>
        </Form>
      </SettingsAccordion>
    </>
  )
}
