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
import { useRef, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AliyunCaptcha, type AliyunCaptchaHandle } from '@/components/aliyun-captcha'
import { useAliyunCaptcha } from '@/features/auth/hooks/use-aliyun-captcha'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { updateUserProfile } from '../../api'

// ============================================================================
// Change Password Dialog Component
// ============================================================================

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  /** User's currently bound email. Empty means no email is bound. */
  currentEmail?: string
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  username,
  currentEmail,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [formData, setFormData] = useState({
    originalPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const aliyunCaptchaRef = useRef<AliyunCaptchaHandle>(null)
  const verificationCaptcha = useAliyunCaptcha('verification')
  const {
    isSending: isSendingCode,
    secondsLeft,
    isActive,
    sendCode,
  } = useEmailVerification({
    getCaptchaVerifyParam: async () =>
      verificationCaptcha.enabled
        ? (await aliyunCaptchaRef.current?.execute()) || ''
        : '',
  })

  const hasEmail = Boolean(currentEmail)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      originalPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setVerificationCode('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasEmail) {
      toast.error(t('Please bind an email address before changing your password'))
      return
    }

    if (!formData.originalPassword) {
      toast.error(t('Please enter your current password'))
      return
    }

    if (!formData.newPassword) {
      toast.error(t('Please enter a new password'))
      return
    }

    if (formData.newPassword.length < 8) {
      toast.error(t('Password must be at least 8 characters'))
      return
    }

    if (formData.originalPassword === formData.newPassword) {
      toast.error(t('New password must be different from current password'))
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('Passwords do not match'))
      return
    }

    if (!verificationCode) {
      toast.error(t('Please enter the email verification code'))
      return
    }

    try {
      setLoading(true)
      const response = await updateUserProfile({
        original_password: formData.originalPassword,
        password: formData.newPassword,
        verification_code: verificationCode,
      })

      if (response.success) {
        toast.success(t('Password changed successfully'))
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(response.message || t('Failed to change password'))
      }
    } catch (_error) {
      toast.error(t('Failed to change password'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendVerificationCode = async () => {
    if (!currentEmail) return
    await sendCode(currentEmail)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm()
    onOpenChange(open)
  }

  const formId = 'change-password-form'
  const emailHelpText = hasEmail
    ? currentEmail
    : t('You need to bind an email address before changing your password.')

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Change Password')}
      description={
        <>
          {t('Update your password for account:')} <strong>{username}</strong>
        </>
      }
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger>
                <span>
                  <Button
                    type='submit'
                    form={formId}
                    disabled={loading || !hasEmail}
                  >
                    {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    {loading ? t('Changing...') : t('Change Password')}
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasEmail && (
                <TooltipContent>
                  {t('Please bind an email address first')}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className='space-y-4'>
        {/* Email info banner */}
        <div className='bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm'>
          <Mail className='text-muted-foreground h-4 w-4 shrink-0' />
          <span className='text-muted-foreground'>{emailHelpText}</span>
        </div>

        {/* Current Password */}
        <div className='space-y-2'>
          <Label htmlFor='currentPassword'>{t('Current Password')}</Label>
          <PasswordInput
            id='currentPassword'
            value={formData.originalPassword}
            onChange={(e) => handleChange('originalPassword', e.target.value)}
            disabled={loading || !hasEmail}
            required
            autoComplete='current-password'
          />
        </div>

        {/* New Password */}
        <div className='space-y-2'>
          <Label htmlFor='newPassword'>{t('New Password')}</Label>
          <PasswordInput
            id='newPassword'
            value={formData.newPassword}
            onChange={(e) => handleChange('newPassword', e.target.value)}
            disabled={loading || !hasEmail}
            required
            minLength={8}
            autoComplete='new-password'
          />
          <p className='text-muted-foreground text-xs'>
            {t('Must be at least 8 characters')}
          </p>
        </div>

        {/* Confirm New Password */}
        <div className='space-y-2'>
          <Label htmlFor='confirmPassword'>{t('Confirm New Password')}</Label>
          <PasswordInput
            id='confirmPassword'
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            disabled={loading || !hasEmail}
            required
            autoComplete='new-password'
          />
        </div>

        {/* Email Verification Code */}
        <div className='space-y-2'>
          <Label>{t('Email Verification Code')}</Label>
          <div className='flex items-end gap-2'>
            <div className='flex-1'>
              <Input
                placeholder={t('Verification code')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={loading || !hasEmail}
                autoComplete='one-time-code'
              />
            </div>
            <Button
              variant='outline'
              type='button'
              disabled={loading || isSendingCode || isActive || !hasEmail}
              onClick={handleSendVerificationCode}
            >
              {isActive ? (
                t('Resend ({{seconds}}s)', { seconds: secondsLeft })
              ) : isSendingCode ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                t('Send code')
              )}
            </Button>
          </div>
        </div>

        {/* Aliyun captcha for sending verification code */}
        {verificationCaptcha.enabled && (
          <AliyunCaptcha
            ref={aliyunCaptchaRef}
            enabled={verificationCaptcha.enabled}
            region={verificationCaptcha.region}
            prefix={verificationCaptcha.prefix}
            sceneId={verificationCaptcha.sceneId}
            className='mt-2'
            onError={(message) => toast.error(t(message))}
          />
        )}
      </form>
    </Dialog>
  )
}
