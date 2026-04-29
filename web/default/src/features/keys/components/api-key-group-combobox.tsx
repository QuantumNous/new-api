import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type ApiKeyGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
}

type ApiKeyGroupComboboxProps = {
  options: ApiKeyGroupOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

function formatGroupRatio(ratio: ApiKeyGroupOption['ratio'], ratioLabel: string) {
  if (ratio === undefined || ratio === null || ratio === '') return null
  return `${ratio}x ${ratioLabel}`
}

function getRatioBadgeClassName(ratio: ApiKeyGroupOption['ratio']) {
  if (typeof ratio !== 'number') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
  }

  if (ratio > 5) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
  }
  if (ratio > 3) {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300'
  }
  if (ratio > 1) {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
}

function GroupRatioBadge({ ratio }: { ratio: ApiKeyGroupOption['ratio'] }) {
  const { t } = useTranslation()
  const label = formatGroupRatio(ratio, t('Ratio'))

  if (!label) return null

  return (
    <Badge variant='outline' className={getRatioBadgeClassName(ratio)}>
      {label}
    </Badge>
  )
}

export function ApiKeyGroupCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
}: ApiKeyGroupComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) => {
      const ratioText = String(option.ratio ?? '').toLowerCase()
      return (
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search) ||
        option.desc?.toLowerCase().includes(search) ||
        ratioText.includes(search)
      )
    })
  }, [options, searchValue])

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className='border-input bg-muted/40 h-auto min-h-20 w-full justify-between gap-3 rounded-lg px-4 py-3 text-start shadow-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-muted/55 hover:text-foreground active:bg-background data-[state=open]:border-ring data-[state=open]:bg-background data-[state=open]:ring-ring/20 data-[state=open]:ring-[3px]'
        >
          <span className='flex min-w-0 flex-1 items-center justify-between gap-3'>
            <span className='min-w-0'>
              <span className='block truncate font-medium'>
                {selectedOption?.value || placeholder || t('Select a group')}
              </span>
              {selectedOption?.desc && (
                <span className='text-muted-foreground block truncate text-xs'>
                  {selectedOption.desc}
                </span>
              )}
            </span>
            <GroupRatioBadge ratio={selectedOption?.ratio} />
          </span>
          <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[side=bottom]:slide-in-from-top-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 data-[side=top]:slide-in-from-bottom-0 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl p-0 shadow-lg data-[state=closed]:duration-75 data-[state=open]:duration-100'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className='max-h-[360px]'>
            <CommandEmpty>{t('No group found.')}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                  className='items-start gap-3 rounded-lg px-3 py-3 transition-colors data-[selected=true]:bg-muted'
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium'>
                      {option.value}
                    </span>
                    {option.desc && (
                      <span className='text-muted-foreground block truncate text-xs'>
                        {option.desc}
                      </span>
                    )}
                  </span>
                  <GroupRatioBadge ratio={option.ratio} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
