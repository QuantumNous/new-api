import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { IconGithub } from '@/assets/brand-icons'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf, getStatus } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { getOAuthState, login, wechatLoginByCode } from '@/features/auth/api'

const formSchema = z.object({
  username: z.string().min(1, 'Please enter your username or email'),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(8, 'Password must be at least 8 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [showWeChatCode, setShowWeChatCode] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  // Load status for dynamic provider buttons if desired
  // Non-blocking, ignore errors
  if (!status) {
    getStatus()
      .then((s) => setStatus(s))
      .catch(() => {})
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      // old backend uses username/password for login
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: turnstileToken,
      })
      if (res.success) {
        if (res.data?.require_2fa) {
          setIsLoading(false)
          navigate({ to: '/otp', replace: true })
          return
        }
        // set uid immediately from login response if available
        try {
          const userId = (res as any)?.data?.id
          if (typeof window !== 'undefined' && userId) {
            window.localStorage.setItem('uid', String(userId))
          }
        } catch {}
        // fetch self info after login success (session cookie)
        try {
          const self = await getSelf()
          if (
            self?.success &&
            (self as any).data?.id &&
            typeof window !== 'undefined'
          ) {
            window.localStorage.setItem('uid', String((self as any).data.id))
          }
        } catch {}
        // we will set user via guard later after navigation, just redirect now
        const targetPath = redirectTo || '/dashboard'
        navigate({ to: targetPath, replace: true })
        toast.success(`Welcome back!`)
      }
    } catch (err) {
      // handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username or Email</FormLabel>
              <FormControl>
                <Input placeholder='Enter your username or email' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='Enter password' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='text-muted-foreground absolute end-0 -top-0.5 text-sm font-medium hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

        {status?.turnstile_check && status?.turnstile_site_key && (
          <div className='mt-2'>
            <Turnstile
              siteKey={status.turnstile_site_key}
              onVerify={(t) => setTurnstileToken(t)}
            />
          </div>
        )}

        {(status?.github_oauth ||
          status?.oidc_enabled ||
          status?.linuxdo_oauth ||
          status?.telegram_oauth ||
          status?.wechat_login) && (
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
              {!!status?.github_oauth && (
                <Button
                  variant='outline'
                  type='button'
                  disabled={isLoading}
                  onClick={async () => {
                    try {
                      const state = await getOAuthState()
                      if (!state) return
                      const clientId = status?.github_client_id
                      if (!clientId) return
                      const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}&scope=user:email`
                      window.open(url, '_self')
                    } catch {}
                  }}
                >
                  <IconGithub className='h-4 w-4' /> GitHub
                </Button>
              )}
              {!!status?.oidc_enabled && (
                <Button
                  variant='outline'
                  type='button'
                  disabled={isLoading}
                  onClick={async () => {
                    try {
                      const state = await getOAuthState()
                      const authz = status?.oidc_authorization_endpoint
                      const clientId = status?.oidc_client_id
                      if (!state || !authz || !clientId) return
                      const url = new URL(authz)
                      url.searchParams.set('client_id', clientId)
                      url.searchParams.set(
                        'redirect_uri',
                        `${window.location.origin}/oauth/oidc`
                      )
                      url.searchParams.set('response_type', 'code')
                      url.searchParams.set('scope', 'openid profile email')
                      url.searchParams.set('state', state)
                      window.open(url.toString(), '_self')
                    } catch {}
                  }}
                >
                  OIDC
                </Button>
              )}
              {!!status?.linuxdo_oauth && (
                <Button
                  variant='outline'
                  type='button'
                  disabled={isLoading}
                  onClick={async () => {
                    try {
                      const state = await getOAuthState()
                      const clientId = status?.linuxdo_client_id
                      if (!state || !clientId) return
                      const url = `https://connect.linux.do/oauth2/authorize?response_type=code&client_id=${clientId}&state=${state}`
                      window.open(url, '_self')
                    } catch {}
                  }}
                >
                  LinuxDO
                </Button>
              )}
              {!!status?.telegram_oauth && (
                <Button
                  variant='outline'
                  type='button'
                  disabled={isLoading}
                  onClick={() => {
                    toast.info(
                      'Telegram login requires widget integration; coming soon'
                    )
                  }}
                >
                  Telegram
                </Button>
              )}
            </div>
          </>
        )}
        {status?.wechat_login && (
          <div className='grid gap-2'>
            <Button
              variant='outline'
              type='button'
              disabled={isLoading}
              onClick={() => setShowWeChatCode((v) => !v)}
            >
              WeChat code login
            </Button>
            {showWeChatCode && (
              <div className='flex items-center gap-2'>
                <Input
                  placeholder='Enter WeChat verification code'
                  value={wechatCode}
                  onChange={(e) => setWeChatCode(e.target.value)}
                  className='max-w-[220px]'
                />
                <Button
                  disabled={isLoading || wechatCode.length === 0}
                  onClick={async () => {
                    try {
                      setIsLoading(true)
                      const res = await wechatLoginByCode(wechatCode)
                      if (res?.success) {
                        try {
                          const userId = (res as any)?.data?.id
                          if (typeof window !== 'undefined' && userId) {
                            window.localStorage.setItem('uid', String(userId))
                          }
                        } catch {}
                        const self = await getSelf()
                        if (self?.success) auth.setUser(self.data as any)
                        navigate({
                          to: redirectTo || '/dashboard',
                          replace: true,
                        })
                        toast.success('Signed in via WeChat')
                      } else {
                        toast.error(res?.message || 'Login failed')
                      }
                    } catch {
                      toast.error('Login failed')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                >
                  Login
                </Button>
              </div>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}
