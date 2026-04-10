import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        <Label className='text-muted-foreground text-xs'>
          {label}
        </Label>
      )}
      <div className='relative inline-block'>
        <Input
          type='text'
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className='h-8 w-20 pr-7 text-center font-mono'
        />
        <div className='absolute inset-y-0 right-0 flex flex-col items-center justify-center pr-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={handleIncrement}
            disabled={
              disabled || (max !== undefined && Number(localValue) >= max)
            }
            className='size-auto h-3.5 w-5 rounded-sm p-0'
          >
            <ChevronUp className='h-3 w-3' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={handleDecrement}
            disabled={disabled || Number(localValue) <= min}
            className='size-auto h-3.5 w-5 rounded-sm p-0'
          >
            <ChevronDown className='h-3 w-3' />
          </Button>
        </div>
      </div>
    </div>
  )
}
