import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitch() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('zh') ? 'zh' : 'en'

  const change = async (lng: 'en' | 'zh') => {
    if (lng === current) return
    await i18n.changeLanguage(lng)
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='scale-95 rounded-full'
          aria-label='Language'
        >
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => change('en')}>
          English
          <Check
            size={14}
            className={cn('ms-auto', current !== 'en' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => change('zh')}>
          简体中文
          <Check
            size={14}
            className={cn('ms-auto', current !== 'zh' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LanguageMenuItems() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('zh') ? 'zh' : 'en'
  const change = async (lng: 'en' | 'zh') => {
    if (lng === current) return
    await i18n.changeLanguage(lng)
  }
  return (
    <>
      <DropdownMenuItem onClick={() => change('en')}>
        English
        <Check
          size={14}
          className={cn('ms-auto', current !== 'en' && 'hidden')}
        />
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => change('zh')}>
        简体中文
        <Check
          size={14}
          className={cn('ms-auto', current !== 'zh' && 'hidden')}
        />
      </DropdownMenuItem>
    </>
  )
}
