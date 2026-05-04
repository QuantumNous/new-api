import { useState } from 'react'
import type { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
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
import {
  otpFormSchema,
  OTP_LENGTH,
  BACKUP_CODE_LENGTH,
} from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { saveUserId } from '@/features/auth/lib/storage'
import {
  isValidOTP,
  isValidBackupCode,
  formatBackupCode,
  cleanBackupCode,
} from '@/features/auth/lib/validation'
import type { User } from '@/features/users/types'

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const { auth } = useAuthStore()
  const { redirectToLogin } = useAuthRedirect()

  const form = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof otpFormSchema>) {
    // Validate based on mode
    if (useBackupCode) {
      if (!isValidBackupCode(data.otp)) {
        toast.error(t('Backup code must be in format XXXX-XXXX'))
        return
      }
    } else {
      if (!isValidOTP(data.otp)) {
        toast.error(t('Verification code must be 6 digits'))
        return
      }
    }

    setIsLoading(true)
    try {
      // Remove all hyphens from backup code before sending to backend
      const code = useBackupCode ? cleanBackupCode(data.otp) : data.otp
      const res = await login2fa({ code })

      if (!res.success) {
        toast.error(res.message || t('Invalid code'))
        return
      }

      // Handle user data from 2FA login response
      const userData = res.data
      if (!userData) {
        throw new Error('No user data received from login')
      }

      // Update auth store
      auth.setUser(userData as User)

      // Store user ID in localStorage for compatibility
      if (userData.id) {
        saveUserId(userData.id)
      }

      toast.success(t('Signed in'))
      redirectToLogin() // This will redirect to dashboard via the redirect logic
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('2FA verification error:', error)
      const errorMessage =
        error instanceof Error ? error.message : t('Verification failed')
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  function handleToggleMode() {
    setUseBackupCode(!useBackupCode)
    form.setValue('otp', '')
  }

  function handleBackToLogin() {
    redirectToLogin()
  }

  const isFormValid = useBackupCode
    ? otp.length >= BACKUP_CODE_LENGTH
    : otp.length >= OTP_LENGTH

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
                {useBackupCode ? t('Backup Code') : t('Verification Code')}
              </FormLabel>
              <FormControl>
                {useBackupCode ? (
                  <Input
                    placeholder={t('Enter backup code (e.g., CAWD-OQDV)')}
                    {...field}
                    maxLength={BACKUP_CODE_LENGTH}
                    autoComplete='off'
                    className='font-mono uppercase'
                    onChange={(e) => {
                      const formatted = formatBackupCode(e.target.value)
                      field.onChange(formatted)
                    }}
                  />
                ) : (
                  <InputOTP
                    maxLength={OTP_LENGTH}
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
                  ? t('Each backup code can only be used once.')
                  : t('Verification code updates every 30 seconds.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2 w-full' disabled={!isFormValid || isLoading}>
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {t('Verify and Sign In')}
        </Button>

        <div className='flex items-center justify-center gap-2 text-sm'>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='text-primary h-auto p-0'
            onClick={handleToggleMode}
          >
            {useBackupCode ? t('Use authenticator code') : t('Use backup code')}
          </Button>
          <span className='text-muted-foreground'>·</span>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='text-primary h-auto p-0'
            onClick={handleBackToLogin}
          >
            {t('Back to login')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
