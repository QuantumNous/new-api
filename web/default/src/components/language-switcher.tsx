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
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { Check, Languages, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { refreshLanguageSensitiveQueries } from '@/lib/i18n-query-refresh'
import {
  detectRegionalPromptLanguage,
  LANGUAGE_REGION_PROMPT_DISMISSED_KEY,
  type RegionalPromptLanguage,
} from '@/lib/regional-language'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const regionalPromptMessages: Record<RegionalPromptLanguage, string> = {
  zh: '你可以在这里切换语言',
  fr: 'Vous pouvez changer de langue ici.',
  ru: 'Здесь можно переключить язык.',
  ja: 'ここで言語を切り替えられます。',
  vi: 'Bạn có thể đổi ngôn ngữ tại đây.',
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.auth.user)
  const currentLanguage = normalizeInterfaceLanguage(i18n.language)
  const [promptLanguage, setPromptLanguage] =
    useState<RegionalPromptLanguage | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(false)

  const dismissRegionalPrompt = useCallback(() => {
    setPromptDismissed(true)
    setPromptOpen(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_REGION_PROMPT_DISMISSED_KEY, 'true')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      window.localStorage.getItem(LANGUAGE_REGION_PROMPT_DISMISSED_KEY) ===
      'true'
    ) {
      return
    }

    setPromptDismissed(false)
    const detectedLanguage = detectRegionalPromptLanguage()
    if (!detectedLanguage) return

    setPromptLanguage(detectedLanguage)
    setPromptOpen(true)
  }, [])

  const handleChangeLanguage = useCallback(
    async (code: string) => {
      const nextLanguage = normalizeInterfaceLanguage(code)
      await i18n.changeLanguage(nextLanguage)
      dismissRegionalPrompt()
      refreshLanguageSensitiveQueries(queryClient)
      if (user) {
        try {
          await api.put('/api/user/self', { language: nextLanguage })
        } catch {
          // Best-effort persistence; don't block the UI on failure
        }
      }
    },
    [dismissRegionalPrompt, i18n, queryClient, user]
  )

  return (
    <Popover
      open={promptOpen}
      onOpenChange={(open) => {
        if (open && !promptDismissed) {
          setPromptOpen(true)
        }
      }}
    >
      <PopoverTrigger render={<span className='inline-flex' />}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={<Button variant='ghost' size='icon' className='h-9 w-9' />}
            onClick={dismissRegionalPrompt}
          >
            <Languages className='size-[1.2rem]' />
            <span className='sr-only'>{t('Change language')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {INTERFACE_LANGUAGE_OPTIONS.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleChangeLanguage(lang.code)}
              >
                {lang.label}
                <Check
                  size={14}
                  className={cn(
                    'ms-auto',
                    currentLanguage !== lang.code && 'hidden'
                  )}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </PopoverTrigger>
      {promptLanguage && (
        <PopoverContent
          side='bottom'
          align='end'
          sideOffset={12}
          className='relative w-60 border-primary/30 pe-9 text-sm shadow-lg shadow-primary/10 ring-primary/20'
        >
          <span className='bg-popover border-primary/30 absolute -top-2 right-4 size-4 rotate-45 border-t border-l shadow-[-2px_-2px_4px_rgba(0,0,0,0.04)]' />
          <span>{regionalPromptMessages[promptLanguage]}</span>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute top-1.5 right-1.5 size-7'
            onClick={dismissRegionalPrompt}
          >
            <X className='size-3.5' />
            <span className='sr-only'>{t('Close')}</span>
          </Button>
        </PopoverContent>
      )}
    </Popover>
  )
}
