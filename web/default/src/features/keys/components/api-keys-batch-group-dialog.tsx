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
import { isAxiosError } from 'axios'
import type { Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { parseQuotaFromDollars } from '@/lib/format'
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { batchEditApiKeys } from '../api'
import {
  coordinateBatchEditApiKeys,
  isBatchQuotaInputValid,
} from '../lib/api-key-batch-group'
import type { ApiKey } from '../types'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'

type ApiKeysBatchEditDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  canEditGroup: boolean
  groupOptions: ApiKeyGroupOption[]
  table: Table<TData>
}

function getServerErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError<{ message?: unknown }>(error)) return undefined

  const message = error.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

export function ApiKeysBatchEditDialog<TData>(
  props: ApiKeysBatchEditDialogProps<TData>
) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [group, setGroup] = useState<string>()
  const [updateQuota, setUpdateQuota] = useState(false)
  const [quotaInput, setQuotaInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedRows = props.table.getFilteredSelectedRowModel().rows
  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const parsedQuotaInput = Number(quotaInput)
  const quotaIsValid =
    !updateQuota || isBatchQuotaInputValid(quotaInput, tokensOnly)
  const hasEdit = (props.canEditGroup && group !== undefined) || updateQuota

  const resetForm = () => {
    setGroup(undefined)
    setUpdateQuota(false)
    setQuotaInput('')
  }

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting) return
    if (!open) resetForm()
    props.onOpenChange(open)
  }

  const handleConfirm = async () => {
    if (!hasEdit || !quotaIsValid) return

    setIsSubmitting(true)
    try {
      const ids = selectedRows.map((row) => (row.original as ApiKey).id)
      const result = await coordinateBatchEditApiKeys({
        request: batchEditApiKeys,
        payload: {
          ids,
          group: props.canEditGroup ? group : undefined,
          remain_quota: updateQuota
            ? parseQuotaFromDollars(parsedQuotaInput)
            : undefined,
        },
        successEffects: {
          resetSelection: () => props.table.resetRowSelection(),
          refresh: triggerRefresh,
          resetForm,
          closeDialog: () => props.onOpenChange(false),
        },
      })
      if (!result.success) {
        toast.error(result.message || t('Failed to update selected API keys'))
        return
      }

      toast.success(
        t('Updated {{count}} API key(s)', {
          count: result.count,
        })
      )
    } catch (error) {
      toast.error(
        getServerErrorMessage(error) || t('Failed to update selected API keys')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-lg' showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>
            {t('Batch edit {{count}} API key(s)', {
              count: selectedRows.length,
            })}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Choose at least one field to update for the selected API keys.'
            )}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className='py-2'>
          {props.canEditGroup && (
            <Field data-disabled={isSubmitting || undefined}>
              <FieldLabel>{t('Group')}</FieldLabel>
              <ApiKeyGroupCombobox
                options={props.groupOptions}
                value={group}
                onValueChange={setGroup}
                placeholder={t('Select a group')}
                ariaLabel={t('Select a group')}
                disabled={isSubmitting}
              />
              <FieldDescription>
                {t('Leave the group unselected to keep it unchanged.')}
              </FieldDescription>
            </Field>
          )}

          <Field data-disabled={isSubmitting || undefined}>
            <div className='flex items-start gap-3 rounded-lg border p-3'>
              <Checkbox
                id='batch-update-available-quota'
                checked={updateQuota}
                onCheckedChange={setUpdateQuota}
                disabled={isSubmitting}
                className='mt-0.5'
              />
              <div className='flex min-w-0 flex-1 flex-col gap-1'>
                <FieldLabel htmlFor='batch-update-available-quota'>
                  {t('Update available quota')}
                </FieldLabel>
                <FieldDescription>
                  {t(
                    'This quota applies to each selected finite-quota API key. Unlimited-quota API keys remain unchanged.'
                  )}
                </FieldDescription>
              </div>
            </div>

            {updateQuota && (
              <Field data-invalid={!quotaIsValid || undefined}>
                <FieldLabel htmlFor='batch-available-quota'>
                  {t('Available quota ({{currency}})', {
                    currency: currencyLabel,
                  })}
                </FieldLabel>
                <Input
                  id='batch-available-quota'
                  type='number'
                  min={0}
                  step={tokensOnly ? 1 : 0.01}
                  value={quotaInput}
                  onChange={(event) => setQuotaInput(event.target.value)}
                  placeholder={
                    tokensOnly
                      ? t('Enter quota in tokens')
                      : t('Enter quota in {{currency}}', {
                          currency: currencyLabel,
                        })
                  }
                  aria-invalid={!quotaIsValid}
                  disabled={isSubmitting}
                />
                {!quotaIsValid && (
                  <FieldDescription>
                    {tokensOnly
                      ? t(
                          'Enter a whole-number quota greater than or equal to zero.'
                        )
                      : t(
                          'Enter a finite quota greater than or equal to zero.'
                        )}
                  </FieldDescription>
                )}
              </Field>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={() => void handleConfirm()}
            disabled={!hasEdit || !quotaIsValid || isSubmitting}
          >
            {isSubmitting && <Spinner data-icon='inline-start' />}
            {t('Apply changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
