import { useMemo } from 'react'
import { Github, Loader2, Send, Shield, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SiLinux, SiWechat } from 'react-icons/si'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'

type OAuthCallbackScreenProps = {
  provider: string
  mode: 'login' | 'bind'
}

type ProviderMeta = {
  label: string
  Icon: LucideIcon | ((props: { className?: string }) => React.JSX.Element)
}

const providerDictionary: Record<string, ProviderMeta> = {
  github: { label: 'GitHub', Icon: Github },
  oidc: { label: 'OIDC', Icon: Shield },
  linuxdo: {
    label: 'LinuxDO',
    Icon: (props: { className?: string }) => (
      <SiLinux className={props.className} focusable='false' />
    ),
  },
  telegram: { label: 'Telegram', Icon: Send },
  wechat: {
    label: 'WeChat',
    Icon: (props: { className?: string }) => (
      <SiWechat className={props.className} focusable='false' />
    ),
  },
}

export function OAuthCallbackScreen({
  provider,
  mode,
}: OAuthCallbackScreenProps) {
  const { label, Icon } = useMemo(() => {
    const normalized = provider?.toLowerCase() ?? ''
    return (
      providerDictionary[normalized] || {
        label: 'account',
        Icon: UserRound,
      }
    )
  }, [provider])

  const headline =
    mode === 'bind'
      ? `Binding your ${label} account`
      : `Signing you in with ${label}`

  const description =
    mode === 'bind'
      ? 'Hang tight while we securely link this account to your profile.'
      : 'Hang tight while we finish connecting your account.'

  const secondaryNote =
    mode === 'bind'
      ? 'You can close this tab once the binding completes or a success message appears in the original window.'
      : "You'll be redirected automatically. You can return to the previous page if nothing happens after a few seconds."

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader className='items-center text-center'>
          <div className='bg-muted flex h-12 w-12 items-center justify-center rounded-full'>
            <Icon className='h-6 w-6' />
          </div>
          <CardTitle className='text-xl font-semibold'>{headline}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 text-center'>
          <div className='flex items-center justify-center gap-2 text-sm font-medium'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span>Processing OAuth response...</span>
          </div>
          <p className='text-muted-foreground text-sm'>{secondaryNote}</p>
          <p className='text-muted-foreground text-xs'>
            This may take a few moments while we validate the request and update
            your session.
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
