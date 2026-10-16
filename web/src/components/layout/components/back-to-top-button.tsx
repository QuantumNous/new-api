/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ArrowUp01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const SHOW_BACK_TO_TOP_OFFSET = 240

type BackToTopButtonProps = {
  scrollContainer: HTMLElement | null
}

export function BackToTopButton(props: BackToTopButtonProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const scrollContainer = props.scrollContainer
    if (!scrollContainer) {
      setVisible(false)
      return
    }

    const updateVisibility = () => {
      setVisible(scrollContainer.scrollTop > SHOW_BACK_TO_TOP_OFFSET)
    }

    scrollContainer.addEventListener('scroll', updateVisibility, {
      passive: true,
    })
    updateVisibility()

    return () => {
      scrollContainer.removeEventListener('scroll', updateVisibility)
    }
  }, [props.scrollContainer])

  const label = t('Back to top')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            variant='secondary'
            size='icon-lg'
            aria-label={label}
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            onClick={() => {
              props.scrollContainer?.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'instant'
                  : 'smooth',
              })
            }}
            data-visible={visible}
            className='bg-background/95 ring-border/70 hover:bg-muted fixed right-5 bottom-5 z-30 shadow-lg ring-1 backdrop-blur transition-all duration-150 data-[visible=false]:pointer-events-none data-[visible=false]:translate-y-2 data-[visible=false]:opacity-0 motion-reduce:transition-none sm:right-6 sm:bottom-6'
          >
            <HugeiconsIcon
              icon={ArrowUp01Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
          </Button>
        }
      />
      <TooltipContent side='left'>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}
