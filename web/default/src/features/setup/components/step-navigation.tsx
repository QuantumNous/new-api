import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface StepNavigationProps {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
  isSubmitting?: boolean
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isSubmitting = false,
}: StepNavigationProps) {
  const { t } = useTranslation()
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center'>
      <div className='flex justify-end gap-2 sm:justify-start'>
        {!isFirstStep && (
          <Button type='button' variant='outline' onClick={onBack}>
            {t('Back')}
          </Button>
        )}
      </div>

      <div className='flex flex-1 justify-end gap-2'>
        {!isLastStep && (
          <Button type='button' onClick={onNext}>
            {t('Next')}
          </Button>
        )}

        {isLastStep && (
          <Button type='button' onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 size-4 animate-spin' />
                {t('Initializing…')}
              </>
            ) : (
              <>
                <CheckCircle2 className='mr-2 size-4' />
                {t('Initialize system')}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
