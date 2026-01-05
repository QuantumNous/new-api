import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Loader2, Server, Settings, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface DeploymentAccessGuardProps {
  children: ReactNode
  loading: boolean
  isEnabled: boolean
  connectionLoading: boolean
  connectionOk: boolean | null
  connectionError: string | null
  onRetry: () => void
}

export function DeploymentAccessGuard({
  children,
  loading,
  isEnabled,
  connectionLoading,
  connectionOk,
  connectionError,
  onRetry,
}: DeploymentAccessGuardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleGoToSettings = () => {
    navigate({ to: '/system-settings/integrations' })
  }

  // Loading state
  if (loading) {
    return (
      <div className='mx-auto mt-8 max-w-md'>
        <div className='flex flex-col items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground mb-4 h-12 w-12 animate-spin' />
          <p className='text-muted-foreground'>{t('Loading...')}</p>
        </div>
      </div>
    )
  }

  // Disabled state
  if (!isEnabled) {
    return (
      <div className='mx-auto mt-8 max-w-md'>
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20'>
            <Server className='h-8 w-8 text-amber-600 dark:text-amber-400' />
          </div>
          <h3 className='mb-6 text-xl font-semibold'>
            {t('Model deployment service is disabled')}
          </h3>
        </div>
        <div className='space-y-4'>
          <Alert variant='default'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>{t('Configuration required')}</AlertTitle>
            <AlertDescription>
              {t(
                'Please enable io.net model deployment service and configure an API key in System Settings.'
              )}
            </AlertDescription>
          </Alert>
          <Button onClick={handleGoToSettings} className='w-full'>
            <Settings className='mr-2 h-4 w-4' />
            {t('Go to settings')}
          </Button>
        </div>
      </div>
    )
  }

  // Connection loading state
  if (connectionLoading) {
    return (
      <div className='mx-auto mt-8 max-w-md'>
        <div className='flex flex-col items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground mb-4 h-12 w-12 animate-spin' />
          <p className='text-muted-foreground'>{t('Checking connection...')}</p>
        </div>
      </div>
    )
  }

  // Connection error state
  if (connectionOk === false && connectionError) {
    return (
      <div className='mx-auto mt-8 max-w-md'>
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20'>
            <WifiOff className='h-8 w-8 text-red-600 dark:text-red-400' />
          </div>
          <h3 className='mb-6 text-xl font-semibold'>
            {t('Connection failed')}
          </h3>
        </div>
        <div className='space-y-4'>
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>{t('Connection error')}</AlertTitle>
            <AlertDescription>{connectionError}</AlertDescription>
          </Alert>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={onRetry} className='flex-1'>
              {t('Retry')}
            </Button>
            <Button onClick={handleGoToSettings} className='flex-1'>
              <Settings className='mr-2 h-4 w-4' />
              {t('Go to settings')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
