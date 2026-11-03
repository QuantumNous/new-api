/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PartnerOAuthClientSecretDialog(props: {
  open: boolean
  secret: string
  clientId: string
  onOpenChange: (open: boolean) => void
  /** Labels the secret; defaults to the OAuth client secret. */
  secretLabel?: string
}) {
  const { t } = useTranslation()
  const secretLabel = props.secretLabel ?? t('Client secret')
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={secretLabel}
      description={t(
        'Copy this secret now. It is shown once and cannot be retrieved later.'
      )}
      contentClassName='sm:max-w-lg'
      footer={
        <Button type='button' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-3'>
        <Alert>
          <AlertTitle>{t('Keep this secret private')}</AlertTitle>
          <AlertDescription>
            {t(
              'Store it in the partner backend only. Do not put it in a mobile or desktop app.'
            )}
          </AlertDescription>
        </Alert>
        <div className='space-y-1.5'>
          <Label htmlFor='partner-oauth-client-id'>{t('Client ID')}</Label>
          <div className='flex gap-2'>
            <Input
              id='partner-oauth-client-id'
              readOnly
              value={props.clientId}
            />
            <CopyButton value={props.clientId} />
          </div>
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='partner-oauth-client-secret'>{secretLabel}</Label>
          <div className='flex gap-2'>
            <Input
              id='partner-oauth-client-secret'
              readOnly
              value={props.secret}
            />
            <CopyButton value={props.secret} />
          </div>
        </div>
      </div>
    </Dialog>
  )
}
