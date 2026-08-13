/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, KeyRound, Loader2, RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SecureVerificationDialog,
  useSecureVerification,
  type VerificationMethod,
} from '@/features/auth/secure-verification'
import { useStatus } from '@/hooks/use-status'
import { clearAuthentication } from '@/lib/auth-session'
import { formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getApiKeys, rotatePrimaryApiKey } from '../api'
import { API_KEY_STATUSES } from '../constants'

export function PrimaryApiKeyCard() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const singleMode =
    status?.single_primary_api_key_enabled === true &&
    (user?.role ?? ROLE.GUEST) === ROLE.USER

  const query = useQuery({
    queryKey: ['primary-api-key'],
    queryFn: () => getApiKeys({ p: 1, size: 1 }),
    enabled: singleMode,
    staleTime: 30_000,
  })
  const verification = useSecureVerification()
  const key = query.data?.data?.items?.[0]
  const statusLabel = key ? API_KEY_STATUSES[key.status] : undefined
  const exhausted =
    key?.status === 4 ||
    Boolean(key && !key.unlimited_quota && key.remain_quota <= 0)

  if (!singleMode) return null

  const handleReset = async () => {
    setConfirmReset(false)
    setIsResetting(true)
    try {
      await verification.startVerification(
        async (proofToken) => {
          if (!proofToken) {
            throw new Error(t('Verification proof was not returned'))
          }
          const response = await rotatePrimaryApiKey(proofToken)
          if (!response.success) {
            throw new Error(response.message || t('Failed to reset API key'))
          }
          return response
        },
        {
          scope: 'primary_api_key.rotate',
          title: t('Verify before resetting API key'),
          description: t(
            'Confirm your identity with Two-factor Authentication or Passkey before rotating this key.'
          ),
        }
      )
    } catch {
      toast.error(t('Failed to reset API key'))
    } finally {
      setIsResetting(false)
    }
  }

  const handleVerification = async (
    method: VerificationMethod,
    code?: string
  ) => {
    try {
      const result = await verification.executeVerification(method, code)
      const response = result as {
        success?: boolean
        data?: { full_key?: string; key?: string }
      }
      const rotatedKey = response?.data?.full_key || response?.data?.key
      if (!rotatedKey) throw new Error(t('API Key was not returned'))
      setNewKey(rotatedKey.startsWith('sk-') ? rotatedKey : `sk-${rotatedKey}`)
    } catch {
      // Verification hook already shows the actionable error.
    }
  }

  const finishReset = () => {
    setNewKey(null)
    clearAuthentication()
    void navigate({ to: '/sign-in', replace: true })
  }

  let keyContent: ReactNode
  if (key) {
    keyContent = (
      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <code className='bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm'>
            {key.key.startsWith('sk-') ? key.key : `sk-${key.key}`}
          </code>
          <span className='text-muted-foreground text-xs'>
            {t('Full key is shown only after a verified reset.')}
          </span>
        </div>
        <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm'>
          <span>
            {key.unlimited_quota
              ? t('Unlimited quota')
              : t('{{quota}} quota remaining', {
                  quota: formatQuota(key.remain_quota),
                })}
          </span>
          {exhausted && (
            <span className='text-warning inline-flex items-center gap-1'>
              <AlertTriangle className='size-4' aria-hidden='true' />
              {t('API calls are paused until you add quota.')}
            </span>
          )}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setConfirmReset(true)}
          disabled={isResetting || verification.open}
          className='gap-2'
        >
          {isResetting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RotateCcw className='size-4' />
          )}
          {t('Reset API key')}
        </Button>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Resetting immediately invalidates the old key and signs you out.'
          )}
        </p>
      </div>
    )
  } else {
    keyContent = (
      <p className='text-muted-foreground text-sm'>
        {t('No API key is available yet.')}
      </p>
    )
  }

  return (
    <>
      <div className='bg-card ring-foreground/10 space-y-4 rounded-xl p-5 ring-1'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <KeyRound
              className='text-primary mt-0.5 size-5'
              aria-hidden='true'
            />
            <div>
              <h2 className='font-medium'>{t('My API Key')}</h2>
              <p className='text-muted-foreground text-sm'>
                {t('Use this key for API calls and dashboard sign-in.')}
              </p>
            </div>
          </div>
          {statusLabel && (
            <span className='text-muted-foreground text-sm'>
              {t(statusLabel.label)}
            </span>
          )}
        </div>

        {query.isLoading ? (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Loader2 className='size-4 animate-spin' /> {t('Loading...')}
          </div>
        ) : (
          keyContent
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('Reset API key?')}
        desc={t(
          'The current key will stop working immediately, including API calls and dashboard sign-in.'
        )}
        destructive
        confirmText={t('Reset API key')}
        isLoading={isResetting}
        handleConfirm={handleReset}
      />

      <Dialog
        open={newKey !== null}
        onOpenChange={() => undefined}
        title={t('Save your new API key')}
        description={t(
          'The old key is already invalid. Copy this key now; it will not be shown again.'
        )}
        showCloseButton={false}
        contentClassName='sm:max-w-md'
        footer={
          <Button onClick={finishReset} className='w-full'>
            {t('I saved it — sign in again')}
          </Button>
        }
      >
        <div className='flex gap-2'>
          <Input
            value={newKey ?? ''}
            readOnly
            className='font-mono text-xs'
            autoFocus
          />
          {newKey && <CopyButton value={newKey} tooltip={t('Copy API key')} />}
        </div>
      </Dialog>

      <SecureVerificationDialog
        open={verification.open}
        onOpenChange={verification.setOpen}
        methods={verification.methods}
        state={verification.state}
        onVerify={handleVerification}
        onCancel={verification.cancel}
        onCodeChange={verification.setCode}
        onMethodChange={verification.switchMethod}
      />
    </>
  )
}
