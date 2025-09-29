import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCountdown } from '@/hooks/use-countdown'
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
import { Turnstile } from '@/components/turnstile'
import { sendPasswordResetEmail, getStatus } from '@/features/auth/api'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email' : undefined),
  }),
})

export function ForgotPasswordForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: 30 })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  })

  if (!status) {
    getStatus()
      .then((s) => setStatus(s))
      .catch(() => {})
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      if (status?.turnstile_check && !turnstileToken) {
        toast.info('Please wait a moment, human check is initializing...')
        return
      }
      const r = await sendPasswordResetEmail(data.email, turnstileToken)
      if (r?.success) {
        form.reset()
        startCountdown()
        toast.success('Reset email sent, please check your inbox')
      }
    } catch (e) {
      // handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-2', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading || isActive}>
          {isActive ? `Resend (${secondsLeft}s)` : 'Send reset email'}
          {isLoading ? <Loader2 className='animate-spin' /> : <ArrowRight />}
        </Button>
        {status?.turnstile_check && status?.turnstile_site_key && (
          <div className='mt-2'>
            <Turnstile
              siteKey={status.turnstile_site_key}
              onVerify={(t) => setTurnstileToken(t)}
            />
          </div>
        )}
      </form>
    </Form>
  )
}
