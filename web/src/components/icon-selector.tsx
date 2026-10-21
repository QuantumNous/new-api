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
// Get all available icon names from @lobehub/icons
import * as LobeIcons from '@lobehub/icons'
import { Upload, Search, X } from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

// Get commonly used icons for the quick pick section (use .Color for colored icons)
const POPULAR_ICONS = [
  'OpenAI.Color',
  'Anthropic.Color',
  'Google.Color',
  'Gemini.Color',
  'Claude.Color',
  'AzureOpenAI.Color',
  'Baichuan.Color',
  'Zhipu.Color',
  'Alibaba.Color',
  'Tencent.Color',
  'ByteDance.Color',
  'Moonshot.Color',
  'DeepSeek.Color',
  'Midjourney.Color',
  'StabilityAI.Color',
  'HuggingFace.Color',
  'Replicate.Color',
  'TogetherAI.Color',
  'FireworksAI.Color',
  'Qwen.Color',
  'Doubao.Color',
  'Groq.Color',
  'Ollama.Color',
  'LMStudio.Color',
  'LocalAI.Color',
]

// Extract all available icon keys from the LobeIcons package
const getAllIconKeys = () => {
  const keys: string[] = []
  const entries = Object.entries(LobeIcons)

  for (const [key, value] of entries) {
    // Skip internal properties
    if (key.startsWith('__') || key.startsWith('_')) continue
    // Skip non-object/non-function values
    if (!value || (typeof value !== 'object' && typeof value !== 'function'))
      continue
    // Skip if key is not a valid component name
    if (!/^[A-Z]/.test(key)) continue
    // Skip non-React exports (ModelProvider enum, etc.) that are plain
    // objects without $$typeof — they would crash when rendered as JSX.
    if (value && typeof value === 'object' && !(value as Record<string, unknown>)['$$typeof']) continue

    keys.push(key)

    // Check if this icon has a .Color or .Avatar sub-component
    if (value && typeof value === 'object') {
      if ('Color' in value) keys.push(`${key}.Color`)
      if ('Avatar' in value) keys.push(`${key}.Avatar`)
    }
  }

  return keys
}

interface IconSelectorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function IconSelector({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: IconSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customIconValue, setCustomIconValue] = useState(value || '')
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string | null>(null)

  const allIconKeys = useMemo(() => getAllIconKeys(), [])

  const filteredIcons = useMemo(() => {
    if (!search) return allIconKeys
    const searchLower = search.toLowerCase()
    return allIconKeys.filter((key) => key.toLowerCase().includes(searchLower))
  }, [allIconKeys, search])

  const popularIcons = useMemo(() => {
    return POPULAR_ICONS.filter((icon) => allIconKeys.includes(icon))
  }, [allIconKeys])

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      onChange?.(iconName)
      setOpen(false)
      setSearch('')
    },
    [onChange]
  )

  const handleCustomIconSubmit = useCallback(() => {
    if (customIconValue.trim()) {
      onChange?.(customIconValue.trim())
      setOpen(false)
    }
  }, [customIconValue, onChange])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setUploadedIconUrl(dataUrl)
        onChange?.(dataUrl)
        setOpen(false)
      }
      reader.readAsDataURL(file)
    },
    [onChange]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.('')
    },
    [onChange]
  )

  // Determine if current value is a data URL
  const isDataUrl = value?.startsWith('data:')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between border-input bg-transparent',
            className
          )}
        >
          <div className='flex items-center gap-2'>
            {value ? (
              isDataUrl ? (
                <img
                  src={value}
                  alt=''
                  className='size-5 rounded object-contain'
                />
              ) : (
                <span className='flex items-center'>
                  {getLobeIcon(value, 20)}
                </span>
              )
            ) : (
              <span className='text-muted-foreground'>
                {placeholder || t('Select icon')}
              </span>
            )}
            {value && !isDataUrl && (
              <span className='text-muted-foreground text-sm'>{value}</span>
            )}
          </div>
          <div className='flex items-center gap-1'>
            {value && (
              <X
                className='text-muted-foreground hover:text-foreground size-4'
                onClick={handleClear}
              />
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-96 p-0' align='start' side='bottom'>
        <Tabs defaultValue='popular' className='w-full'>
          <div className='border-b p-2'>
            <TabsList className='w-full'>
              <TabsTrigger value='popular' className='flex-1'>
                {t('Popular')}
              </TabsTrigger>
              <TabsTrigger value='upload' className='flex-1'>
                {t('Upload')}
              </TabsTrigger>
              <TabsTrigger value='custom' className='flex-1'>
                {t('Custom')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Popular Icons */}
          <TabsContent value='popular' className='p-2'>
            <div className='relative mb-2'>
              <Search className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
              <Input
                placeholder={t('Search icons...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-8'
              />
            </div>
            <div className='grid max-h-[300px] grid-cols-6 gap-2 overflow-auto'>
              {(search ? filteredIcons : popularIcons).map((iconName) => (
                <button
                  key={iconName}
                  type='button'
                  onClick={() => handleSelectIcon(iconName)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 rounded-lg border p-2 transition-all hover:bg-accent',
                    value === iconName && 'ring-2 ring-ring'
                  )}
                  title={iconName}
                >
                  <span className='flex size-8 items-center justify-center'>
                    {getLobeIcon(iconName, 24)}
                  </span>
                  <span className='text-muted-foreground max-w-full truncate text-[10px]'>
                    {iconName.split('.')[0]}
                  </span>
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Upload Icon */}
          <TabsContent value='upload' className='p-4'>
            <div className='flex flex-col items-center justify-center gap-4'>
              <div className='text-center'>
                <p className='text-sm font-medium'>{t('Upload custom icon')}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('Recommended: 28x28 pixels, PNG/SVG/JPG')}
                </p>
              </div>
              <label className='cursor-pointer'>
                <input
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={handleFileUpload}
                />
                <Button
                  type='button'
                  variant='outline'
                  className='flex items-center gap-2'
                >
                  <Upload className='size-4' />
                  {t('Select file')}
                </Button>
              </label>
              {uploadedIconUrl && (
                <div className='mt-2 flex items-center gap-2'>
                  <img
                    src={uploadedIconUrl}
                    alt=''
                    className='size-10 rounded object-contain'
                  />
                  <span className='text-muted-foreground text-xs'>
                    {t('Uploaded')}
                  </span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Custom Icon Name */}
          <TabsContent value='custom' className='p-4'>
            <div className='flex flex-col gap-4'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>{t('Enter icon name')}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('You can manually enter an icon name from @lobehub/icons')}
                </p>
              </div>
              <Input
                placeholder='OpenAI, Anthropic, etc.'
                value={customIconValue}
                onChange={(e) => setCustomIconValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomIconSubmit()
                  }
                }}
              />
              {customIconValue && (
                <div className='flex items-center justify-center gap-2 rounded-lg border p-4'>
                  {getLobeIcon(customIconValue, 32)}
                  <span className='text-muted-foreground text-sm'>
                    {t('Preview')}
                  </span>
                </div>
              )}
              <Button
                type='button'
                onClick={handleCustomIconSubmit}
                disabled={!customIconValue.trim()}
              >
                {t('Use this icon')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
