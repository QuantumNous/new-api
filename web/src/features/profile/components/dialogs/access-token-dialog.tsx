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
import { RefreshCw, Loader2, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useAccessToken } from '../../hooks'

// ============================================================================
// Access Token Dialog Component
// ============================================================================

interface AccessTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccessTokenDialog({
  open,
  onOpenChange,
}: AccessTokenDialogProps) {
  const { t } = useTranslation()
  const { token, generating, generate } = useAccessToken()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Regenerating invalidates the previous token server-side and cannot be
  // undone, so it must never happen as a side effect of opening this dialog.
  // The confirmation state is reset on close so a reopened dialog starts idle.
  useEffect(() => {
    if (!open) {
      setConfirmOpen(false)
    }
  }, [open])

  const handleConfirm = async () => {
    setConfirmOpen(false)
    await generate()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('Access Token')}
        description={t(
          "Your system access token for API authentication. Keep it secure and don't share it with others."
        )}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('Close')}
            </Button>
            <Button
              type='button'
              variant={token ? 'default' : 'destructive'}
              onClick={() => setConfirmOpen(true)}
              disabled={generating}
              className='gap-2'
            >
              {generating ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <RefreshCw className='h-4 w-4' />
              )}
              {generating ? t('Generating...') : t('Regenerate')}
            </Button>
          </>
        }
      >
        <div className='my-6 space-y-4'>
          {token ? (
            <div className='space-y-2'>
              <Label htmlFor='token'>{t('Token')}</Label>
              <div className='flex gap-2'>
                <Input
                  id='token'
                  type='text'
                  value={token}
                  readOnly
                  className='font-mono text-xs'
                />
                <CopyButton
                  value={token}
                  variant='outline'
                  className='size-9'
                  iconClassName='size-4'
                  tooltip={t('Copy token')}
                  aria-label={t('Copy token')}
                />
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'This token is shown only once. Store it now — it cannot be retrieved later.'
                )}
              </p>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-3 py-4 text-center'>
              <div className='bg-muted flex size-10 items-center justify-center rounded-full'>
                <KeyRound className='text-muted-foreground size-5' />
              </div>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'For security reasons the existing token cannot be displayed again. Regenerating creates a new token and invalidates the current one immediately.'
                )}
              </p>
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        isLoading={generating}
        title={t('Regenerate access token?')}
        desc={t(
          'The current token stops working immediately. Any integration still using it will fail until you update it with the new token.'
        )}
        confirmText={t('Regenerate')}
        handleConfirm={handleConfirm}
      />
    </>
  )
}
