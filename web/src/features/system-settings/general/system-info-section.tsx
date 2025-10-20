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
import { useUpdateOption } from '../hooks/use-update-option'

const systemInfoSchema = z.object({
  Notice: z.string().optional(),
  SystemName: z.string().min(1, 'System name is required'),
  Logo: z.string().url().optional().or(z.literal('')),
  Footer: z.string().optional(),
  About: z.string().optional(),
  HomePageContent: z.string().optional(),
})

type SystemInfoFormValues = z.infer<typeof systemInfoSchema>

type SystemInfoSectionProps = {
  defaultValues: SystemInfoFormValues
}

export function SystemInfoSection({ defaultValues }: SystemInfoSectionProps) {
  const updateOption = useUpdateOption()

  const form = useForm<SystemInfoFormValues>({
    resolver: zodResolver(systemInfoSchema),
    defaultValues,
  })

  const onSubmit = async (data: SystemInfoFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof SystemInfoFormValues]
    )

    if (updates.length === 0) {
      toast.info('No changes to save')
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value as string })
    }

    form.reset(data)
  }

  const handleReset = () => {
    form.reset(defaultValues, {
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
