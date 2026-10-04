import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PasskeyDomainSelectorProps {
  rpIds: string[]
  value?: string
  onChange: (rpId: string) => void
}

export function PasskeyDomainSelector({
  rpIds,
  value,
  onChange,
}: PasskeyDomainSelectorProps) {
  const { t } = useTranslation()
  if (rpIds.length < 2) return null

  return (
    <div className='space-y-2'>
      <label className='text-sm font-medium'>{t('Passkey domain')}</label>
      <Select
        value={value ?? rpIds[0]}
        onValueChange={(next) => {
          if (next) onChange(next)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('Select Passkey domain')} />
        </SelectTrigger>
        <SelectContent>
          {rpIds.map((rpId) => (
            <SelectItem key={rpId} value={rpId}>
              {rpId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
