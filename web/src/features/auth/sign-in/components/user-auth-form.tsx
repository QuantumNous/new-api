import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { Loader2, LogIn, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  buildAssertionResult,
  prepareCredentialRequestOptions,
  isPasskeySupported as detectPasskeySupport,
} from '@/lib/passkey'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
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
import { login, wechatLoginByCode } from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { loginFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import type { AuthFormProps } from '@/features/auth/types'

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showWeChatCode, setShowWeChatCode] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

  const { status } = useStatus()
  const passkeyLoginEnabled = Boolean(
    status?.passkey_login ?? status?.data?.passkey_login
  )
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginSuccess, redirectTo2FA } = useAuthRedirect()

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const passkeyButtonDisabled =
    isPasskeyLoading ||
    !passkeySupported ||
    (requiresLegalConsent && !agreedToLegal)

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    detectPasskeySupport()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error('Please agree to the legal terms first')
      return
    }

    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: turnstileToken,
      })

      if (res.success) {
        if (res.data?.require_2fa) {
          redirectTo2FA()
          return
        }

        await handleLoginSuccess(res.data, redirectTo)
        toast.success('Welcome back!')
      }
    } catch (error) {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  async function handleWeChatLogin() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error('Please agree to the legal terms first')
      return
    }

    if (!wechatCode.trim()) return

    setIsLoading(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success) {
        await handleLoginSuccess(res.data, redirectTo)
        toast.success('Signed in via WeChat')
      } else {
        toast.error(res?.message || 'Login failed')
      }
    } catch (error) {
      toast.error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error('Please agree to the legal terms first')
      return
    }

    if (!passkeySupported) {
      toast.error('Passkey is not supported on this device')
      return
    }

    if (!navigator?.credentials) {
      toast.error('Passkey is not available in this browser')
      return
    }

    setIsPasskeyLoading(true)
    try {
      const begin = await beginPasskeyLogin()
      if (!begin.success) {
        throw new Error(begin.message || 'Failed to start Passkey login')
      }

      const publicKey = prepareCredentialRequestOptions(
        begin.data?.options ?? begin.data
      )

      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null

      if (!credential) {
        toast.info('Passkey login was cancelled')
        return
      }

      const assertion = buildAssertionResult(credential)
      if (!assertion) {
        throw new Error('Invalid Passkey response')
      }

      const finish = await finishPasskeyLogin(assertion)
      if (!finish.success) {
        throw new Error(finish.message || 'Failed to complete Passkey login')
      }

      if (!finish.data) {
        throw new Error('Missing user data from Passkey login response')
      }

      await handleLoginSuccess(
        finish.data as { id?: number } | null,
        redirectTo
      )
      toast.success('Signed in with Passkey')
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info('Passkey login was cancelled or timed out')
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Passkey login failed')
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        {/* Username Field */}
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

        {/* Password Field */}
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

        {/* Submit Button */}
        <Button
          className='mt-2'
          disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
        >
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

        {/* Turnstile */}
        {isTurnstileEnabled && (
          <div className='mt-2'>
            <Turnstile
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
            />
          </div>
        )}

        <LegalConsent
          status={status}
          checked={agreedToLegal}
          onCheckedChange={setAgreedToLegal}
          className='mt-1'
        />

        {passkeyLoginEnabled && (
          <div className='mt-2 space-y-1'>
            <Button
              type='button'
              variant='outline'
              disabled={passkeyButtonDisabled}
              onClick={handlePasskeyLogin}
              className='w-full justify-center gap-2'
            >
              {isPasskeyLoading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <KeyRound className='h-4 w-4' />
              )}
              Sign in with Passkey
            </Button>
            {!passkeySupported && (
              <p className='text-muted-foreground text-xs'>
                Passkey is not supported on this device.
              </p>
            )}
          </div>
        )}

        {/* OAuth Providers */}
        <OAuthProviders
          status={status}
          disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
        />

        {/* WeChat Login */}
        {status?.wechat_login && (
          <div className='grid gap-2'>
            <Button
              variant='outline'
              type='button'
              disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
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
                  disabled={
                    isLoading ||
                    !wechatCode.trim() ||
                    (requiresLegalConsent && !agreedToLegal)
                  }
                  onClick={handleWeChatLogin}
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
