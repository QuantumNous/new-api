import { useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'

const ssrfSchema = z.object({
  'fetch_setting.enable_ssrf_protection': z.boolean(),
  'fetch_setting.allow_private_ip': z.boolean(),
  'fetch_setting.domain_filter_mode': z.boolean(),
  'fetch_setting.ip_filter_mode': z.boolean(),
  'fetch_setting.domain_list': z.string(),
  'fetch_setting.ip_list': z.string(),
  'fetch_setting.allowed_ports': z.string(),
  'fetch_setting.apply_ip_filter_for_domain': z.boolean(),
})

type SSRFFormValues = z.infer<typeof ssrfSchema>

type SSRFSectionProps = {
  defaultValues: Omit<
    SSRFFormValues,
    | 'fetch_setting.domain_list'
    | 'fetch_setting.ip_list'
    | 'fetch_setting.allowed_ports'
  > & {
    'fetch_setting.domain_list': string[]
    'fetch_setting.ip_list': string[]
    'fetch_setting.allowed_ports': number[]
  }
}

export function SSRFSection({ defaultValues }: SSRFSectionProps) {
  const updateOption = useUpdateOption()

  const form = useForm<SSRFFormValues>({
    resolver: zodResolver(ssrfSchema),
    defaultValues: {
      'fetch_setting.enable_ssrf_protection':
        defaultValues['fetch_setting.enable_ssrf_protection'],
      'fetch_setting.allow_private_ip':
        defaultValues['fetch_setting.allow_private_ip'],
      'fetch_setting.domain_filter_mode':
        defaultValues['fetch_setting.domain_filter_mode'],
      'fetch_setting.ip_filter_mode':
        defaultValues['fetch_setting.ip_filter_mode'],
      'fetch_setting.domain_list':
        defaultValues['fetch_setting.domain_list'].join('\n'),
      'fetch_setting.ip_list':
        defaultValues['fetch_setting.ip_list'].join('\n'),
      'fetch_setting.allowed_ports':
        defaultValues['fetch_setting.allowed_ports'].join(','),
      'fetch_setting.apply_ip_filter_for_domain':
        defaultValues['fetch_setting.apply_ip_filter_for_domain'],
    },
  })

  useEffect(() => {
    form.reset({
      'fetch_setting.enable_ssrf_protection':
        defaultValues['fetch_setting.enable_ssrf_protection'],
      'fetch_setting.allow_private_ip':
        defaultValues['fetch_setting.allow_private_ip'],
      'fetch_setting.domain_filter_mode':
        defaultValues['fetch_setting.domain_filter_mode'],
      'fetch_setting.ip_filter_mode':
        defaultValues['fetch_setting.ip_filter_mode'],
      'fetch_setting.domain_list':
        defaultValues['fetch_setting.domain_list'].join('\n'),
      'fetch_setting.ip_list':
        defaultValues['fetch_setting.ip_list'].join('\n'),
      'fetch_setting.allowed_ports':
        defaultValues['fetch_setting.allowed_ports'].join(','),
      'fetch_setting.apply_ip_filter_for_domain':
        defaultValues['fetch_setting.apply_ip_filter_for_domain'],
    })
  }, [defaultValues, form])

  const onSubmit = async (data: SSRFFormValues) => {
    const updates: Array<{ key: string; value: string | boolean }> = []

    Object.entries(data).forEach(([key, value]) => {
      if (
        key === 'fetch_setting.domain_list' ||
        key === 'fetch_setting.ip_list'
      ) {
        if (typeof value === 'string') {
          const list = value.split('\n').filter((d: string) => d.trim())
          const origKey = key as
            | 'fetch_setting.domain_list'
            | 'fetch_setting.ip_list'
          if (JSON.stringify(list) !== JSON.stringify(defaultValues[origKey])) {
            updates.push({ key, value: JSON.stringify(list) })
          }
        }
      } else if (key === 'fetch_setting.allowed_ports') {
        if (typeof value === 'string') {
          const ports = value
            .split(',')
            .map((p: string) => parseInt(p.trim()))
            .filter((p: number) => !isNaN(p))
          if (
            JSON.stringify(ports) !==
            JSON.stringify(defaultValues['fetch_setting.allowed_ports'])
          ) {
            updates.push({ key, value: JSON.stringify(ports) })
          }
        }
      } else {
        const defaultKey = key as keyof typeof defaultValues
        if (value !== defaultValues[defaultKey]) {
          updates.push({ key, value })
        }
      }
    })

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  const domainFilterMode = form.watch('fetch_setting.domain_filter_mode')
  const ipFilterMode = form.watch('fetch_setting.ip_filter_mode')

  return (
    <SettingsAccordion
      value='ssrf-protection'
      title='SSRF Protection'
      description='Prevent server-side request forgery attacks by controlling outbound requests.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='fetch_setting.enable_ssrf_protection'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Enable SSRF Protection
                  </FormLabel>
                  <FormDescription>
                    Prevent server-side request forgery attacks
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
            name='fetch_setting.allow_private_ip'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Allow Private IPs</FormLabel>
                  <FormDescription>
                    Allow requests to private IP ranges (10.0.0.0/8,
                    172.16.0.0/12, 192.168.0.0/16)
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
            name='fetch_setting.domain_filter_mode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Domain Filter Mode</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === 'true')}
                  value={field.value ? 'true' : 'false'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='false'>
                      Blacklist (Block listed domains)
                    </SelectItem>
                    <SelectItem value='true'>
                      Whitelist (Only allow listed domains)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Choose how to filter domains</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='fetch_setting.domain_list'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Domain {domainFilterMode ? 'Whitelist' : 'Blacklist'}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='example.com&#10;blocked-site.com'
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormDescription>One domain per line</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='fetch_setting.ip_filter_mode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>IP Filter Mode</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === 'true')}
                  value={field.value ? 'true' : 'false'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='false'>
                      Blacklist (Block listed IPs)
                    </SelectItem>
                    <SelectItem value='true'>
                      Whitelist (Only allow listed IPs)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose how to filter IP addresses
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='fetch_setting.ip_list'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  IP {ipFilterMode ? 'Whitelist' : 'Blacklist'}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='192.168.1.1&#10;10.0.0.0/8'
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormDescription>One IP or CIDR range per line</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='fetch_setting.allowed_ports'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Allowed Ports</FormLabel>
                <FormControl>
                  <Input placeholder='80,443,8080' {...field} />
                </FormControl>
                <FormDescription>
                  Comma-separated list of allowed ports (empty = all ports)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='fetch_setting.apply_ip_filter_for_domain'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Apply IP Filter to Resolved Domains
                  </FormLabel>
                  <FormDescription>
                    Check resolved IPs against IP filters even when accessing by
                    domain
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

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save SSRF settings'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
