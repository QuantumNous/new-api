import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NumericSpinnerInputProps {
  value: number | null | undefined
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  label?: string
}

export function NumericSpinnerInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled = false,
  className,
  label,
}: NumericSpinnerInputProps) {
  // Local state for controlled input
  const [localValue, setLocalValue] = useState(String(value ?? 0))

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(String(value ?? 0))
  }, [value])

  const handleIncrement = () => {
    const currentValue = Number(localValue) || 0
    const newValue = currentValue + step
    if (max === undefined || newValue <= max) {
      const finalValue = newValue
      setLocalValue(String(finalValue))
      onChange(finalValue)
    }
  }

  const handleDecrement = () => {
    const currentValue = Number(localValue) || 0
    const newValue = currentValue - step
    if (newValue >= min) {
      setLocalValue(String(newValue))
      onChange(newValue)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Allow empty input for better UX
    if (inputValue === '') {
      setLocalValue('')
      return
    }

    // Only allow numbers
    if (!/^\d+$/.test(inputValue)) {
      return
    }

    const numValue = Number(inputValue)

    // Validate range
    if (max !== undefined && numValue > max) {
      return
    }

    if (numValue < min) {
      return
    }

    setLocalValue(inputValue)
  }

  const handleBlur = () => {
    // On blur, ensure we have a valid value
    const numValue = Number(localValue)
    if (isNaN(numValue) || localValue === '') {
      setLocalValue('0')
      onChange(0)
    } else {
      onChange(numValue)
    }
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && (
        <label className='text-muted-foreground text-xs font-medium'>
          {label}
        </label>
      )}
      <div className='relative flex items-center'>
        <Input
          type='text'
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className='h-7 w-14 pr-5 text-center font-mono text-xs'
        />
        <div className='absolute right-0.5 flex flex-col'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={handleIncrement}
            disabled={
              disabled || (max !== undefined && Number(localValue) >= max)
            }
            className='hover:bg-accent h-3 w-4 rounded-sm p-0'
          >
            <ChevronUp className='h-2.5 w-2.5' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={handleDecrement}
            disabled={disabled || Number(localValue) <= min}
            className='hover:bg-accent h-3 w-4 rounded-sm p-0'
          >
            <ChevronDown className='h-2.5 w-2.5' />
          </Button>
        </div>
      </div>
    </div>
  )
}
