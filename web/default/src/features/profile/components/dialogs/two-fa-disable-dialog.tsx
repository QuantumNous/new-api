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
import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { disable2FA } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================================================
// Two-FA Disable Dialog Component
// ============================================================================

interface TwoFADisableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TwoFADisableDialog({
  open,
  onOpenChange,
  onSuccess,
}: TwoFADisableDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const handleDisable = async () => {
    if (!code) {
      toast.error(t('Please enter your verification code or backup code'))
      return
    }

    if (!confirmed) {
      toast.error(t('Please confirm that you understand the consequences'))
      return
    }

    try {
      setLoading(true)
      const response = await disable2FA(code)

      if (response.success) {
        toast.success(t('Two-factor authentication disabled'))
        onOpenChange(false)
        onSuccess()
        // Reset
        setCode('')
        setConfirmed(false)
      } else {
        toast.error(response.message || t('Failed to disable 2FA'))
      }
    } catch (_error) {
      toast.error(t('Failed to disable 2FA'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      if (!open) {
        setCode('')
        setConfirmed(false)
      }
      onOpenChange(open)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-destructive flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            {t('Disable Two-Factor Authentication')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'This action will permanently remove 2FA protection from your account.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>
              {t('Warning: Disabling 2FA will make your account less secure.')}
            </AlertDescription>
          </Alert>

          <div className='space-y-2'>
            <Label htmlFor='code'>{t('Verification Code')}</Label>
            <Input
              id='code'
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('Enter code or backup code')}
              disabled={loading}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Enter your authenticator code or a backup code')}
            </p>
          </div>

          <div className='flex items-start space-x-2'>
            <Checkbox
              id='confirm'
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
            />
            <Label
              htmlFor='confirm'
              className='text-sm leading-tight font-normal'
            >
              {t(
                'I understand that disabling 2FA will remove all protection and backup codes'
              )}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant='destructive'
            onClick={handleDisable}
            disabled={loading || !code || !confirmed}
          >
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {loading ? t('Disabling...') : t('Disable 2FA')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
