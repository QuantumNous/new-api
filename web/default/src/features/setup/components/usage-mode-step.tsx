import type { ComponentType } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Building2, Home, Presentation } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  titleKey: string
  descriptionKey: string
  icon: ComponentType<{ className?: string }>
}> = [
  {
    value: 'external',
    titleKey: 'External operations',
    descriptionKey:
      'Serve multiple users or teams with billing and quota control.',
    icon: Building2,
  },
  {
    value: 'self',
    titleKey: 'Personal use',
    descriptionKey:
      'Best for single-tenant deployments. Pricing and billing options stay hidden.',
    icon: Home,
  },
  {
    value: 'demo',
    titleKey: 'Demo site',
    descriptionKey:
      'Showcase core capabilities with demo credentials and limited access.',
    icon: Presentation,
  },
]

export function UsageModeStep({ form }: UsageModeStepProps) {
  const { t } = useTranslation()

  return (
    <FormField
      control={form.control}
      name='usageMode'
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('How will you use the platform?')}</FormLabel>
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
                ({ value, titleKey, descriptionKey, icon: Icon }) => {
                  const isSelected = field.value === value
                  return (
                    <Label
                      key={value}
                      htmlFor={`usage-mode-${value}`}
                      className={cn(
                        'hover:border-primary/40 focus-within:border-primary/50 group bg-card flex cursor-pointer flex-col gap-3 rounded-xl border p-4 font-normal transition-all',
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
                            {t(titleKey)}
                          </Label>
                          <p className='text-muted-foreground mt-2 text-sm'>
                            {t(descriptionKey)}
                          </p>
                        </div>
                        <Icon className='text-muted-foreground/70 group-hover:text-primary group-focus:text-primary ml-auto size-5 shrink-0 transition' />
                      </div>
                    </Label>
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
