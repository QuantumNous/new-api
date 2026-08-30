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
import { KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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
  const { token, generating, generate, clearToken } = useAccessToken()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (generating) return

    if (!nextOpen) {
      setConfirmOpen(false)
      clearToken()
    }
    onOpenChange(nextOpen)
  }

  const handleGenerate = async () => {
    if (await generate()) {
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
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
              onClick={() => handleOpenChange(false)}
              disabled={generating}
            >
              {t('Close')}
            </Button>
            <Button
              type='button'
              onClick={() => setConfirmOpen(true)}
              disabled={generating}
              className='gap-2'
            >
              {generating ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
              ) : (
                <RefreshCw className='h-4 w-4' aria-hidden='true' />
              )}
              {generating ? t('Generating...') : t('Regenerate')}
            </Button>
          </>
        }
      >
        <div className='my-6'>
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
                  "Save this token now. You won't be able to view it again after closing this dialog."
                )}
              </p>
            </div>
          ) : (
            <Empty className='border py-8'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <KeyRound aria-hidden='true' />
                </EmptyMedia>
                <EmptyTitle>
                  {t('Access tokens are shown only once')}
                </EmptyTitle>
                <EmptyDescription>
                  {t(
                    'For security, existing access tokens cannot be displayed. Regenerate only when you need a new token.'
                  )}
                </EmptyDescription>
                <EmptyDescription>
                  {t(
                    'Regenerating immediately invalidates any existing token.'
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => {
          if (!generating) setConfirmOpen(nextOpen)
        }}
        title={t('Regenerate access token?')}
        desc={
          <div className='space-y-2'>
            <p>
              {t(
                'This will immediately invalidate your existing access token. Any applications or scripts using it will stop working.'
              )}
            </p>
            <p>
              {t(
                'The new token will only be shown once. Copy it and store it securely.'
              )}
            </p>
          </div>
        }
        confirmText={
          generating ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
              {t('Generating...')}
            </>
          ) : (
            t('Regenerate token')
          )
        }
        destructive
        isLoading={generating}
        handleConfirm={handleGenerate}
      />
    </>
  )
}
