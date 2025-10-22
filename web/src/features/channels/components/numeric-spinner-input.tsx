import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    <div className={cn('inline-flex', className)}>
      {label && (
        <label className='text-muted-foreground text-xs font-medium'>
          {label}
        </label>
      )}
      <div className='relative inline-block'>
        <input
          type='text'
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className='bg-background border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-20 rounded-md border px-3 py-1 pr-7 text-center font-mono transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        />
        <div className='absolute inset-y-0 right-0 flex flex-col items-center justify-center pr-1'>
          <button
            type='button'
            onClick={handleIncrement}
            disabled={
              disabled || (max !== undefined && Number(localValue) >= max)
            }
            className='hover:bg-accent flex h-3.5 w-5 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          >
            <ChevronUp className='h-3 w-3' />
          </button>
          <button
            type='button'
            onClick={handleDecrement}
            disabled={disabled || Number(localValue) <= min}
            className='hover:bg-accent flex h-3.5 w-5 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          >
            <ChevronDown className='h-3 w-3' />
          </button>
        </div>
      </div>
    </div>
  )
}
