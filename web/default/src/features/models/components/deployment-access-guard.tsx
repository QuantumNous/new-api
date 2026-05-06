import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Server,
  Settings,
  WifiOff,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type LoadingPhase = 'idle' | 'settings' | 'connection' | 'done'
type StepStatus = 'pending' | 'loading' | 'done'

function getSettingsStatus(phase: LoadingPhase): StepStatus {
  if (phase === 'settings') return 'loading'
  if (phase === 'connection' || phase === 'done') return 'done'
  return 'pending'
}

function getConnectionStatus(
  phase: LoadingPhase,
  connectionOk: boolean | null
): StepStatus {
  if (phase === 'connection') return 'loading'
  if (phase === 'done' && connectionOk) return 'done'
  return 'pending'
}

interface DeploymentAccessGuardProps {
  children: ReactNode
  loading: boolean
  loadingPhase?: LoadingPhase
  isEnabled: boolean
  connectionLoading: boolean
  connectionOk: boolean | null
  connectionError: string | null
  onRetry: () => void
}

function LoadingStep({
  label,
  status,
}: {
  label: string
  status: 'pending' | 'loading' | 'done'
}) {
  return (
    <div className='flex items-center gap-3'>
      {status === 'loading' && (
        <Loader2 className='text-primary h-5 w-5 animate-spin' />
      )}
      {status === 'done' && <CheckCircle2 className='h-5 w-5 text-green-500' />}
      {status === 'pending' && (
        <Circle className='text-muted-foreground/40 h-5 w-5' />
      )}
      <span
        className={cn(
          'text-sm',
          status === 'loading' && 'text-foreground font-medium',
          status === 'done' && 'text-muted-foreground',
          status === 'pending' && 'text-muted-foreground/60'
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function DeploymentAccessGuard({
  children,
  loading,
  loadingPhase = 'settings',
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

  // Combined loading state with step indicator
  if (loading || connectionLoading) {
    const settingsStatus = getSettingsStatus(loadingPhase)
    const connectionStatus = getConnectionStatus(loadingPhase, connectionOk)

    return (
      <div className='mx-auto mt-8 max-w-md'>
        <div className='flex flex-col items-center justify-center py-12'>
          <Loader2 className='text-primary mb-6 h-10 w-10 animate-spin' />
          <div className='space-y-3'>
            <LoadingStep
              label={t('Loading configuration')}
              status={settingsStatus}
            />
            <LoadingStep
              label={t('Checking connection')}
              status={connectionStatus}
            />
          </div>
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
            <AlertDescription>{t(connectionError)}</AlertDescription>
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
