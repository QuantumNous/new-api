import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandItem } from '@/components/ui/command'

export type Option = {
  label: string
  value: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: MultiSelectProps) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('Select items...')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')

  const handleUnselect = (value: string) => {
    onChange(selected.filter((s) => s !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current
    if (input) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (input.value === '' && selected.length > 0) {
          onChange(selected.slice(0, -1))
        }
      }
      if (e.key === 'Escape') {
        input.blur()
      }
    }
  }

  const selectables = options.filter(
    (option) => !selected.includes(option.value)
  )

  return (
    <Command
      onKeyDown={handleKeyDown}
      className={`overflow-visible bg-transparent ${className || ''}`}
    >
      <div className='group border-input ring-offset-background focus-within:ring-ring rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2'>
        <div className='flex flex-wrap gap-1'>
          {selected.map((value) => {
            const option = options.find((o) => o.value === value)
            return (
              <Badge key={value} variant='secondary'>
                {option?.label || value}
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Remove'
                  className='ml-1 size-auto p-0'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnselect(value)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={() => handleUnselect(value)}
                >
                  <X
                    className='text-muted-foreground hover:text-foreground h-3 w-3'
                    aria-hidden='true'
                  />
                </Button>
              </Badge>
            )
          })}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? resolvedPlaceholder : ''}
            className='placeholder:text-muted-foreground flex-1 bg-transparent outline-none'
          />
        </div>
      </div>
      <div className='relative'>
        {open && selectables.length > 0 ? (
          <div className='bg-popover text-popover-foreground animate-in absolute top-0 z-10 w-full rounded-md border shadow-md outline-none'>
            <CommandGroup className='h-full max-h-60 overflow-auto'>
              {selectables.map((option) => {
                return (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onSelect={() => {
                      setInputValue('')
                      onChange([...selected, option.value])
                    }}
                    className='cursor-pointer'
                  >
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ) : null}
      </div>
    </Command>
  )
}
