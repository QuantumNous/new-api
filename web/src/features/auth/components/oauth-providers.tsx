import { IconGithub } from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { useOAuthLogin } from '../hooks/use-oauth-login'
import type { SystemStatus } from '../types'

interface OAuthProvidersProps {
  status: SystemStatus | null
  disabled?: boolean
}

export function OAuthProviders({
  status,
  disabled = false,
}: OAuthProvidersProps) {
  const {
    isLoading,
    handleGitHubLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
  } = useOAuthLogin(status)

  const hasAnyProvider =
    status?.github_oauth ||
    status?.oidc_enabled ||
    status?.linuxdo_oauth ||
    status?.telegram_oauth

  if (!hasAnyProvider) return null

  const isButtonDisabled = disabled || isLoading

  return (
    <>
      <div className='relative my-2'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>
            Or continue with
          </span>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        {status?.github_oauth && (
          <Button
            variant='outline'
            type='button'
            disabled={isButtonDisabled}
            onClick={handleGitHubLogin}
          >
            <IconGithub className='h-4 w-4' /> GitHub
          </Button>
        )}
        {status?.oidc_enabled && (
          <Button
            variant='outline'
            type='button'
            disabled={isButtonDisabled}
            onClick={handleOIDCLogin}
          >
            OIDC
          </Button>
        )}
        {status?.linuxdo_oauth && (
          <Button
            variant='outline'
            type='button'
            disabled={isButtonDisabled}
            onClick={handleLinuxDOLogin}
          >
            LinuxDO
          </Button>
        )}
        {status?.telegram_oauth && (
          <Button
            variant='outline'
            type='button'
            disabled={isButtonDisabled}
            onClick={handleTelegramLogin}
          >
            Telegram
          </Button>
        )}
      </div>
    </>
  )
}
