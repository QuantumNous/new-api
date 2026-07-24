/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
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
import { Label } from '@/components/ui/label'
import {
  checkUserSendEmailChallenge,
  createUserSendEmailChallenge,
  register,
  wechatLoginByCode,
} from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { registerFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  getAffiliateCode,
  saveAffiliateCode,
} from '@/features/auth/lib/storage'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { isAuthBundle } from '@/lib/api'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [userSendEmailCode, setUserSendEmailCode] = useState('')
  const [userSendEmailRecipient, setUserSendEmailRecipient] = useState('')
  const [isCreatingEmailChallenge, setIsCreatingEmailChallenge] =
    useState(false)
  const [isCheckingEmailChallenge, setIsCheckingEmailChallenge] =
    useState(false)
  const [isUserSendEmailVerified, setIsUserSendEmailVerified] = useState(false)
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')
  const { copyToClipboard } = useCopyToClipboard()

  const { status } = useStatus()
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { redirectToLogin, handleLoginSuccess } = useAuthRedirect()
  const {
    isSending: isSendingCode,
    secondsLeft,
    isActive,
    sendCode,
  } = useEmailVerification({
    turnstileToken,
    validateTurnstile,
  })

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const emailValue = form.watch('email')
  const emailVerificationRequired = !!status?.email_verification
  const userSendEmailVerificationRequired = Boolean(
    status?.user_send_email_verification ??
    status?.data?.user_send_email_verification
  )
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const oauthRegisterEnabled =
    status?.oauth_register_enabled ??
    status?.data?.oauth_register_enabled ??
    true
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const turnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)
  let sendVerificationCodeButtonContent: ReactNode = t('Send code')
  if (isActive) {
    sendVerificationCodeButtonContent = t('Resend ({{seconds}}s)', {
      seconds: secondsLeft,
    })
  } else if (isSendingCode) {
    sendVerificationCodeButtonContent = (
      <Loader2 className='h-4 w-4 animate-spin' />
    )
  }
  const userSendEmailInstruction = t(
    'Send an email from {{email}} to {{recipient}}',
    {
      email: emailValue,
      recipient: userSendEmailRecipient,
    }
  )
  const recipientStart = userSendEmailInstruction.indexOf(
    userSendEmailRecipient
  )
  const instructionBeforeRecipient =
    recipientStart >= 0
      ? userSendEmailInstruction.slice(0, recipientStart)
      : userSendEmailInstruction
  const instructionAfterRecipient =
    recipientStart >= 0
      ? userSendEmailInstruction.slice(
          recipientStart + userSendEmailRecipient.length
        )
      : ''

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
  }, [])

  useEffect(() => {
    setUserSendEmailCode('')
    setUserSendEmailRecipient('')
    setIsUserSendEmailVerified(false)
  }, [emailValue])

  async function onSubmit(data: z.infer<typeof registerFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    // Validate email verification if required
    if (emailVerificationRequired) {
      if (!data.email) {
        toast.error(t('Please enter your email'))
        return
      }
      if (!verificationCode) {
        toast.error(t('Please enter the verification code'))
        return
      }
    }

    if (userSendEmailVerificationRequired) {
      if (!data.email) {
        toast.error(t('Please enter your email'))
        return
      }
      if (!isUserSendEmailVerified || !userSendEmailCode) {
        toast.error(t('Please complete user-sent email verification'))
        return
      }
    }

    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code:
          (userSendEmailVerificationRequired
            ? userSendEmailCode
            : verificationCode) || undefined,
        aff_code: getAffiliateCode(),
        turnstile: turnstileToken,
      })

      if (res?.success) {
        toast.success(t('Account created! Please sign in'))
        redirectToLogin()
      } else {
        toast.error(res?.message || t('Failed to create account'))
      }
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendVerificationCode() {
    if (await sendCode(emailValue || '')) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }
  }

  async function handleCreateUserSendEmailChallenge() {
    if (!emailValue) {
      toast.error(t('Please enter your email'))
      return
    }
    if (!validateTurnstile()) return

    setIsCreatingEmailChallenge(true)
    try {
      const res = await createUserSendEmailChallenge(emailValue, turnstileToken)
      if (!res.success || !res.data) {
        toast.error(res.message || t('Failed to create email challenge'))
        return
      }
      setUserSendEmailCode(res.data.code)
      setUserSendEmailRecipient(res.data.recipient)
      setIsUserSendEmailVerified(false)
      toast.success(t('Email challenge created'))
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsCreatingEmailChallenge(false)
    }
  }

  async function handleCheckUserSendEmailChallenge() {
    if (!emailValue || !userSendEmailCode) return

    setIsCheckingEmailChallenge(true)
    try {
      const res = await checkUserSendEmailChallenge(
        emailValue,
        userSendEmailCode
      )
      if (!res.success) {
        toast.error(res.message || t('Verification email not found'))
        return
      }
      setIsUserSendEmailVerified(true)
      toast.success(t('Email verified'))
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsCheckingEmailChallenge(false)
    }
  }

  const handleOpenWeChatDialog = () => {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success && isAuthBundle(res.data)) {
        await handleLoginSuccess(res.data)
        toast.success(t('Signed in via WeChat'))
        handleWeChatDialogChange(false)
      } else {
        if (getServerErrorMessageKey(res)) return
        toast.error(res?.message || t('Login failed'))
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      toast.error(t('Login failed'))
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {/* Username Field */}
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Username')}</FormLabel>
              <FormControl>
                <Input placeholder={t('Enter your username')} {...field} />
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
            <FormItem>
              <FormLabel>{t('Password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder={t('Enter password (8-20 characters)')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirm Password Field */}
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Confirm password')}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={t('Confirm password')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {(emailVerificationRequired || userSendEmailVerificationRequired) && (
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Email (required for verification)')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('name@example.com')}
                    type='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Email Verification Section */}
        {emailVerificationRequired && (
          <div className='flex items-end gap-2'>
            <div className='flex-1'>
              <Input
                placeholder={t('Verification code')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
            </div>
            <Button
              variant='outline'
              type='button'
              disabled={
                isLoading ||
                isSendingCode ||
                isActive ||
                !emailValue ||
                !turnstileReady
              }
              onClick={handleSendVerificationCode}
            >
              {sendVerificationCodeButtonContent}
            </Button>
          </div>
        )}

        {userSendEmailVerificationRequired &&
          (!userSendEmailCode ? (
            <Button
              variant='outline'
              type='button'
              disabled={
                isLoading ||
                isCreatingEmailChallenge ||
                !emailValue ||
                !turnstileReady
              }
              onClick={handleCreateUserSendEmailChallenge}
              className='w-full gap-2'
            >
              {isCreatingEmailChallenge ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : null}
              {t('Create email challenge')}
            </Button>
          ) : (
            <div className='bg-muted/50 space-y-3 rounded-md border p-3 text-sm'>
              <p className='leading-6'>
                {instructionBeforeRecipient}
                <button
                  type='button'
                  className='bg-background hover:bg-accent focus-visible:ring-ring inline max-w-full cursor-copy rounded border px-1.5 py-0.5 font-mono break-all transition-colors focus-visible:ring-2 focus-visible:outline-none'
                  onClick={() => copyToClipboard(userSendEmailRecipient)}
                  title={t('Copy to clipboard')}
                  aria-label={t('Copy to clipboard')}
                >
                  {userSendEmailRecipient}
                </button>
                {instructionAfterRecipient}
              </p>
              <div className='space-y-1.5'>
                <p className='leading-5'>
                  {t('Include this verification content in the email body:')}
                </p>
                <button
                  type='button'
                  className='bg-background hover:bg-accent focus-visible:ring-ring block w-full cursor-copy rounded border px-2.5 py-2 text-left font-mono break-all transition-colors focus-visible:ring-2 focus-visible:outline-none'
                  onClick={() => copyToClipboard(userSendEmailCode)}
                  title={t('Copy verification content')}
                  aria-label={t('Copy verification content')}
                >
                  {userSendEmailCode}
                </button>
              </div>
              <Button
                variant={isUserSendEmailVerified ? 'secondary' : 'outline'}
                type='button'
                disabled={isCheckingEmailChallenge || isUserSendEmailVerified}
                onClick={handleCheckUserSendEmailChallenge}
                className='w-full gap-2'
              >
                {isCheckingEmailChallenge ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {isUserSendEmailVerified
                  ? t('Email verified')
                  : t('I have sent the email, check now')}
              </Button>
            </div>
          ))}

        {/* Turnstile */}
        {isTurnstileEnabled && (
          <div className='mt-2'>
            <Turnstile
              key={turnstileWidgetKey}
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

        {/* Submit Button */}
        <Button
          type='submit'
          className='mt-2 w-full justify-center gap-2'
          disabled={
            isLoading ||
            (requiresLegalConsent && !agreedToLegal) ||
            !turnstileReady
          }
        >
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {t('Create account')}
        </Button>

        {oauthRegisterEnabled && (
          <OAuthProviders
            status={status}
            disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
            onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
            isWeChatLoading={isWeChatSubmitting}
            className='pt-2'
          />
        )}
      </form>

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
          )}
          contentClassName='max-w-sm'
          headerClassName='text-left'
          contentHeight='auto'
          bodyClassName='space-y-4'
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={
                  isWeChatSubmitting ||
                  !wechatCode.trim() ||
                  (requiresLegalConsent && !agreedToLegal)
                }
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
