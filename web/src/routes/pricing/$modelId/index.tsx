import { createFileRoute, ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModelDetails } from '@/features/pricing/components/model-details'

function ModelDetailsErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <div className='text-center'>
        <div className='bg-destructive/10 text-destructive mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full'>
          <AlertTriangle className='h-8 w-8' />
        </div>
        <h2 className='mb-2 text-xl font-semibold'>
          Failed to load model details
        </h2>
        <p className='text-muted-foreground mb-4 max-w-md'>
          {error.message ||
            'An unexpected error occurred while loading the model details.'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/pricing/$modelId/')({
  component: ModelDetails,
  errorComponent: ModelDetailsErrorComponent,
})
