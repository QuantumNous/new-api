import { Languages, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
]

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-9 w-9 rounded-full'>
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>{t('Change language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
          >
            {lang.label}
            <Check
              size={14}
              className={cn('ms-auto', i18n.language !== lang.code && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
