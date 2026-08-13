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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { createApiKey } from '@/features/keys/api'
import { ERROR_MESSAGES } from '@/features/keys/constants'
import { buildDefaultApiKeyPayload } from '@/features/keys/lib/auto-create-api-key'

export interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the id of the freshly created key so it can be pre-selected. */
  onCreated: (keyId: number) => void | Promise<void>
}

/**
 * The overview's own create dialog. The keys page offers group, quota, expiry
 * and model-access controls; here the point is to get a runnable sample fast,
 * so only the name is asked for and everything else takes the same defaults
 * the auto-created first key uses.
 */
export function CreateApiKeyDialog(props: CreateApiKeyDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const trimmedName = name.trim()
  const nameMissing = trimmedName === ''

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting) return
    if (!open) {
      setName('')
      setSubmitted(false)
    }
    props.onOpenChange(open)
  }

  const handleSubmit = async () => {
    // Synchronous re-entry guard: Enter plus a fast double-click can fire
    // before the pending state re-renders the disabled controls.
    if (isSubmitting) return
    setSubmitted(true)
    if (nameMissing) return

    setIsSubmitting(true)
    try {
      const result = await createApiKey(
        buildDefaultApiKeyPayload({ name: trimmedName })
      )
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.CREATE_FAILED))
        return
      }

      // A success response without a usable id cannot be pre-selected; treat
      // it as a failure instead of handing the caller a bogus key id.
      const createdId = result.data?.id
      if (
        typeof createdId !== 'number' ||
        !Number.isInteger(createdId) ||
        createdId <= 0
      ) {
        toast.error(t(ERROR_MESSAGES.UNEXPECTED))
        return
      }

      // The list refresh and the selection are the caller's business; this
      // dialog only reports which key was created.
      await props.onCreated(createdId)
      toast.success(t('API key created'))
      setName('')
      setSubmitted(false)
      props.onOpenChange(false)
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      {/* Base UI suppresses backdrops on nested dialogs, so this one has to
          ask for it explicitly — without it the popup sits flat on the
          integration dialog beneath. The backdrop itself keeps the shared
          default, so creating a key looks the same here as on the keys page. */}
      <DialogContent
        className='sm:max-w-md'
        forceOverlay
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>{t('Create API Key')}</DialogTitle>
          <DialogDescription>
            {t('Name the key — everything else uses the default settings.')}
          </DialogDescription>
        </DialogHeader>

        <Field data-invalid={(submitted && nameMissing) || undefined}>
          <FieldLabel htmlFor='overview-create-api-key-name'>
            {t('Name')}
          </FieldLabel>
          <Input
            id='overview-create-api-key-name'
            value={name}
            autoFocus
            placeholder={t('Enter a name')}
            disabled={isSubmitting}
            aria-invalid={submitted && nameMissing}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {submitted && nameMissing && (
            <FieldError>{t('Please enter a name')}</FieldError>
          )}
        </Field>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting && <Spinner data-icon='inline-start' />}
            {isSubmitting ? t('Creating...') : t('Create API Key')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
