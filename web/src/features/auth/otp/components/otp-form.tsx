import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { login2fa } from '@/features/auth/api'

const formSchema = z.object({
  otp: z.string().min(1, 'Please enter a code.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    // Validate based on mode
    if (useBackupCode) {
      if (data.otp.length !== 8) {
        toast.error('Backup code must be 8 characters')
        return
      }
    } else {
      if (!/^\d{6}$/.test(data.otp)) {
        toast.error('Verification code must be 6 digits')
        return
      }
    }

    setIsLoading(true)
    try {
      const res = await login2fa({ code: data.otp })
      if (!res.success) {
        toast.error(res.message || 'Invalid code')
        return
      }
      // fetch user info
      const self = await getSelf()
      if (self?.success) {
        useAuthStore.getState().auth.setUser(self.data as any)
        try {
          if (typeof window !== 'undefined' && (self as any).data?.id) {
            window.localStorage.setItem('uid', String((self as any).data.id))
          }
        } catch {}
      }
      navigate({ to: '/dashboard', replace: true })
      toast.success('Signed in')
    } catch (e) {
      toast.error('Verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  function handleToggleMode() {
    setUseBackupCode(!useBackupCode)
    form.setValue('otp', '')
  }

  function handleBackToLogin() {
    navigate({ to: '/sign-in', replace: true })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {useBackupCode ? 'Backup Code' : 'Verification Code'}
              </FormLabel>
              <FormControl>
                {useBackupCode ? (
                  <Input
                    placeholder='Enter 8-character backup code'
                    {...field}
                    maxLength={8}
                    autoComplete='off'
                  />
                ) : (
                  <InputOTP
                    maxLength={6}
                    {...field}
                    containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                )}
              </FormControl>
              <FormDescription className='text-muted-foreground text-xs'>
                {useBackupCode
                  ? 'Each backup code can only be used once.'
                  : 'Verification code updates every 30 seconds.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          className='w-full'
          disabled={
            (useBackupCode ? otp.length < 8 : otp.length < 6) || isLoading
          }
        >
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          Verify and Sign In
        </Button>
        <div className='flex items-center justify-center gap-4 text-sm'>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='text-primary'
            onClick={handleToggleMode}
          >
            {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
          </Button>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='text-primary'
            onClick={handleBackToLogin}
          >
            Back to login
          </Button>
        </div>
      </form>
    </Form>
  )
}
