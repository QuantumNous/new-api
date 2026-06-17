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
import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  parseAmountBonusJson,
  parseAmountBonusLimitJson,
  serializeAmountBonusTiers,
  setAmountBonusLimit,
  upsertAmountBonusTier,
  type AmountBonusTier,
} from './amount-bonus-utils'

type AmountBonusVisualEditorProps = {
  value: string
  onChange: (value: string) => void
  limitValue?: string
  onLimitChange?: (value: string) => void
}

export function AmountBonusVisualEditor({
  value,
  onChange,
  limitValue = '',
  onLimitChange,
}: AmountBonusVisualEditorProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [claimLimit, setClaimLimit] = useState('')
  const [editData, setEditData] = useState<AmountBonusTier | null>(null)

  const tiers = useMemo(() => parseAmountBonusJson(value), [value])
  const limits = useMemo(
    () => parseAmountBonusLimitJson(limitValue),
    [limitValue]
  )
  const amountNumber = Number(amount)
  const bonusAmountNumber = Number(bonusAmount)
  const claimLimitNumber = claimLimit.trim() === '' ? 0 : Number(claimLimit)
  const canSave =
    Number.isInteger(amountNumber) &&
    amountNumber > 0 &&
    Number.isInteger(bonusAmountNumber) &&
    bonusAmountNumber > 0 &&
    Number.isInteger(claimLimitNumber) &&
    claimLimitNumber >= 0

  const resetDraft = () => {
    setAmount('')
    setBonusAmount('')
    setClaimLimit('')
    setEditData(null)
  }

  const handleSave = () => {
    if (!canSave) {
      return
    }

    onChange(
      upsertAmountBonusTier(value, editData, {
        amount: amountNumber,
        bonusAmount: bonusAmountNumber,
      })
    )
    onLimitChange?.(setAmountBonusLimit(limitValue, amountNumber, claimLimitNumber))
    resetDraft()
  }

  const handleDelete = (tier: AmountBonusTier) => {
    onChange(
      serializeAmountBonusTiers(
        tiers.filter((item) => item.amount !== tier.amount)
      )
    )
    onLimitChange?.(setAmountBonusLimit(limitValue, tier.amount, 0))
    if (editData?.amount === tier.amount) {
      resetDraft()
    }
  }

  const handleEdit = (tier: AmountBonusTier) => {
    setEditData(tier)
    setAmount(String(tier.amount))
    setBonusAmount(String(tier.bonusAmount))
    const existingLimit = limits[tier.amount]
    setClaimLimit(existingLimit ? String(existingLimit) : '')
  }

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Configure bonus credit for each recharge amount. Values use the same unit as recharge amounts.'
        )}
      </p>

      {tiers.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
          {t(
            'No bonus tiers configured. Add a recharge amount and bonus amount below.'
          )}
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Recharge Amount')}</TableHead>
                <TableHead>{t('Bonus Credit')}</TableHead>
                <TableHead>{t('Wallet Credit')}</TableHead>
                <TableHead>{t('Claim Limit')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.amount}>
                  <TableCell className='font-mono'>{tier.amount}</TableCell>
                  <TableCell className='font-mono text-[#FF2D78]'>
                    +{tier.bonusAmount}
                  </TableCell>
                  <TableCell className='font-mono'>
                    {tier.amount + tier.bonusAmount}
                  </TableCell>
                  <TableCell className='font-mono'>
                    {limits[tier.amount] ? limits[tier.amount] : t('Unlimited')}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleEdit(tier)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleDelete(tier)
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end'>
        <div>
          <Label htmlFor='amount-bonus-recharge' className='mb-2 block'>
            {t('Recharge Amount')}
          </Label>
          <Input
            id='amount-bonus-recharge'
            type='number'
            step='1'
            min='1'
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={t('e.g., 20')}
          />
        </div>
        <div>
          <Label htmlFor='amount-bonus-credit' className='mb-2 block'>
            {t('Bonus Credit')}
          </Label>
          <Input
            id='amount-bonus-credit'
            type='number'
            step='1'
            min='1'
            value={bonusAmount}
            onChange={(event) => setBonusAmount(event.target.value)}
            placeholder={t('e.g., 5')}
          />
        </div>
        <div>
          <Label htmlFor='amount-bonus-limit' className='mb-2 block'>
            {t('Claim Limit')}
          </Label>
          <Input
            id='amount-bonus-limit'
            type='number'
            step='1'
            min='0'
            value={claimLimit}
            onChange={(event) => setClaimLimit(event.target.value)}
            placeholder={t('0 = unlimited')}
          />
        </div>
        <Button
          type='button'
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleSave()
          }}
          disabled={!canSave}
          className='w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 sm:mr-2' />
          <span>{editData ? t('Update') : t('Add')}</span>
        </Button>
      </div>
    </div>
  )
}
