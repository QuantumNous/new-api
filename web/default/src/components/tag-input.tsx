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
import { useId, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  options?: string[]
  allowCreate?: boolean
  id?: string
}

export function TagInput({
  value = [],
  onChange,
  placeholder,
  className,
  disabled = false,
  options,
  allowCreate = true,
  id,
}: TagInputProps) {
  const { t } = useTranslation()
  const placeholderText = placeholder ?? t('Add tags...')
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = `${useId()}-options`
  const filteredOptions = useMemo(() => {
    if (!options) return []
    const selected = new Set(value.map((tag) => tag.toLowerCase()))
    const search = inputValue.trim().toLowerCase()
    return options.filter(
      (option) =>
        !selected.has(option.toLowerCase()) &&
        (!search || option.toLowerCase().includes(search))
    )
  }, [inputValue, options, value])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setInputValue('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (allowCreate) addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const handleBlur = () => {
    if (!options && inputValue.trim() && allowCreate) {
      addTag(inputValue)
    }
    if (options) setInputValue('')
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className='border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 w-full flex-wrap items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Badge key={tag} variant='secondary' className='gap-1 pr-1'>
            {tag}
            {!disabled && (
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label='Remove tag'
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0'
              >
                <X className='h-3 w-3' aria-hidden='true' />
              </Button>
            )}
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          type='text'
          role={options ? 'combobox' : undefined}
          aria-expanded={options ? open : undefined}
          aria-controls={options ? listboxId : undefined}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholderText : ''}
          disabled={disabled}
          className='placeholder:text-muted-foreground min-w-[120px] flex-1 border-0 bg-transparent shadow-none outline-none focus-visible:ring-0'
        />
      </div>
      {options && open && filteredOptions.length > 0 && (
        <div className='bg-popover text-popover-foreground absolute top-full z-100 mt-1 max-h-52 w-full overflow-y-auto rounded-md border p-1 shadow-md'>
          <ul id={listboxId} role='listbox'>
            {filteredOptions.map((option) => (
              <li key={option} role='option' aria-selected={false}>
                <button
                  type='button'
                  className='hover:bg-accent hover:text-accent-foreground w-full rounded-sm px-2 py-1.5 text-left text-sm'
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(option)}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
