import { useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isArray } from '../utils/json-validators'

type AmountOptionsVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function AmountOptionsVisualEditor({
  value,
  onChange,
}: AmountOptionsVisualEditorProps) {
  const { t } = useTranslation()
  const [newAmount, setNewAmount] = useState('')

  const amounts = useMemo(() => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      validatorMessage: t('Amount options must be a JSON array'),
      context: 'amount options',
    })

    return parsed
      .filter((item) => typeof item === 'number' || !isNaN(Number(item)))
      .map(Number)
      .sort((a, b) => a - b)
  }, [value])

  const handleAdd = () => {
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) {
      return
    }

    try {
      const updatedAmounts = [...amounts, amount]
        .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        .sort((a, b) => a - b)

      onChange(JSON.stringify(updatedAmounts, null, 2))
      setNewAmount('')
    } catch (error) {
      console.error('Failed to add amount:', error)
    }
  }

  const handleRemove = (amount: number) => {
    try {
      const updatedAmounts = amounts.filter((a) => a !== amount)
      onChange(JSON.stringify(updatedAmounts, null, 2))
    } catch (error) {
      console.error('Failed to remove amount:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-muted-foreground mb-3 text-sm'>
          {t('Preset recharge amounts displayed to users')}
        </p>

        {amounts.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
            {t(
              'No amount options configured. Add amounts below to get started.'
            )}
          </div>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {amounts.map((amount) => (
              <Badge
                key={amount}
                variant='secondary'
                className='gap-2 py-2 pr-2 pl-3 text-base'
              >
                <span className='font-mono'>${amount}</span>
                <button
                  type='button'
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRemove(amount)
                  }}
                  className='hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors'
                  aria-label={t('Remove ${{amount}}', { amount })}
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
        <div className='flex-1'>
          <label
            htmlFor='new-amount'
            className='mb-2 block text-sm font-medium'
          >
            {t('Add new amount')}
          </label>
          <Input
            id='new-amount'
            type='number'
            step='0.01'
            min='0'
            placeholder={t('e.g., 100')}
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          type='button'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAdd()
          }}
          disabled={!newAmount || parseFloat(newAmount) <= 0}
          className='w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='sm:inline'>{t('Add')}</span>
        </Button>
      </div>
    </div>
  )
}
