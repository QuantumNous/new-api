import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
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
import { register, sendEmailVerification, getStatus } from '@/features/auth/api'

const formSchema = z
  .object({
    username: z.string().min(1, 'Please enter your username'),
    email: z.string().optional(),
    password: z
      .string()
      .min(1, 'Please enter your password')
      .min(8, 'Password must be at least 8 characters long')
      .max(20, 'Password must be at most 20 characters long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  // removed unused pair; countdown/disableButton covers UX needs
  const [status, setStatus] = useState<any>(null)
  const [code, setCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [disableButton, setDisableButton] = useState(false)
  const [countdown, setCountdown] = useState(30)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Watch email to update the disabled state reactively when typing
  const emailValue = form.watch('email')

  if (!status) {
    getStatus()
      .then((s) => setStatus(s))
      .catch(() => {})
  }

  useEffect(() => {
    let timer: any
    if (disableButton && countdown > 0) {
      timer = setTimeout(() => setCountdown((v) => v - 1), 1000)
    } else if (disableButton && countdown === 0) {
      setDisableButton(false)
      setCountdown(30)
    }
    return () => clearTimeout(timer)
  }, [disableButton, countdown])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      // Align with old frontend: when email verification is enabled, email & code are required
      if (status?.email_verification) {
        if (!data.email) {
          toast.error('Please enter your email')
          setIsLoading(false)
          return
        }
        if (!code) {
          toast.error('Please enter the verification code')
          setIsLoading(false)
          return
        }
      }
      const aff =
        typeof window !== 'undefined' ? (localStorage.getItem('aff') ?? '') : ''
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code: code || undefined,
        aff,
        turnstile: turnstileToken,
      })
      if (res?.success) {
        toast.success('Account created! Please sign in')
        navigate({ to: '/sign-in', replace: true })
      }
    } catch (e) {
      // Errors are handled by global interceptor
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
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder='Enter your username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='Enter password (8-20 characters)'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='Confirm password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {status?.email_verification && (
          <>
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (required for verification)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='name@example.com'
                      type='email'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <Input
                  placeholder='Verification code'
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button
                variant='outline'
                type='button'
                disabled={isLoading || disableButton || !emailValue}
                onClick={async () => {
                  try {
                    if (status?.turnstile_check && !turnstileToken) {
                      toast.info(
                        'Please wait a moment, human check is initializing...'
                      )
                      return
                    }
                    const r = await sendEmailVerification(
                      emailValue!,
                      turnstileToken
                    )
                    if (r?.success) {
                      setDisableButton(true)
                      toast.success('Verification email sent')
                    }
                  } catch {
                    // Errors are handled by global interceptor
                  }
                }}
              >
                {disableButton ? `Resend (${countdown}s)` : 'Send code'}
              </Button>
            </div>
            {status?.turnstile_check && status?.turnstile_site_key && (
              <div className='mt-2'>
                <Turnstile
                  siteKey={status.turnstile_site_key}
                  onVerify={(t) => setTurnstileToken(t)}
                />
              </div>
            )}
          </>
        )}
        {!status?.email_verification && (
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder='name@example.com'
                    type='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button className='mt-2' disabled={isLoading}>
          Create account
        </Button>
      </form>
    </Form>
  )
}
