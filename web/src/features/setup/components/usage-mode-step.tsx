import type { ComponentType } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Building2, Home, Presentation } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { SetupFormValues, SetupUsageMode } from '../types'

interface UsageModeStepProps {
  form: UseFormReturn<SetupFormValues>
}

const USAGE_MODE_OPTIONS: Array<{
  value: SetupUsageMode
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
}> = [
  {
    value: 'external',
    title: 'External operations',
    description:
      'Serve multiple users or teams with billing and quota control.',
    icon: Building2,
  },
  {
    value: 'self',
    title: 'Personal use',
    description:
      'Best for single-tenant deployments. Pricing and billing options stay hidden.',
    icon: Home,
  },
  {
    value: 'demo',
    title: 'Demo site',
    description:
      'Showcase core capabilities with demo credentials and limited access.',
    icon: Presentation,
  },
]

export function UsageModeStep({ form }: UsageModeStepProps) {
  return (
    <FormField
      control={form.control}
      name='usageMode'
      render={({ field }) => (
        <FormItem>
          <FormLabel>How will you use New API?</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={(value) => {
                form.clearErrors('usageMode')
                field.onChange(value as SetupUsageMode)
              }}
              className='grid gap-3 sm:grid-cols-3'
            >
              {USAGE_MODE_OPTIONS.map(
                ({ value, title, description, icon: Icon }) => {
                  const isSelected = field.value === value
                  return (
                    <label
                      key={value}
                      htmlFor={`usage-mode-${value}`}
                      className={cn(
                        'hover:border-primary/40 focus-within:border-primary/50 group bg-card flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all',
                        isSelected
                          ? 'border-primary ring-primary/20 ring-2'
                          : 'border-muted'
                      )}
                    >
                      <div className='flex items-center gap-3'>
                        <RadioGroupItem
                          id={`usage-mode-${value}`}
                          value={value}
                          className='mt-1'
                        />
                        <div>
                          <Label
                            htmlFor={`usage-mode-${value}`}
                            className='text-base leading-none font-semibold'
                          >
                            {title}
                          </Label>
                          <p className='text-muted-foreground mt-2 text-sm'>
                            {description}
                          </p>
                        </div>
                        <Icon className='text-muted-foreground/70 group-hover:text-primary group-focus:text-primary ml-auto size-5 shrink-0 transition' />
                      </div>
                    </label>
                  )
                }
              )}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
