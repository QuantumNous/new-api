import z from 'zod'
import { createFileRoute, ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pricing } from '@/features/pricing'

const pricingSearchSchema = z.object({
  vendor: z.string().optional(),
  group: z.string().optional(),
  endpoint: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  quota: z.enum(['all', '0', '1']).optional(),
  currency: z.enum(['USD', 'CNY']).optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  showRecharge: z.enum(['true', 'false']).optional(),
})

function PricingErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <div className='text-center'>
        <div className='bg-destructive/10 text-destructive mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full'>
          <AlertTriangle className='h-8 w-8' />
        </div>
        <h2 className='mb-2 text-xl font-semibold'>Failed to load pricing</h2>
        <p className='text-muted-foreground mb-4 max-w-md'>
          {error.message ||
            'An unexpected error occurred while loading the pricing information.'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/pricing/')({
  validateSearch: pricingSearchSchema,
  component: Pricing,
  errorComponent: PricingErrorComponent,
})
