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
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

export function GlobeIntro() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const [contactOpen, setContactOpen] = useState(false)
  const [text, setText] = useState('')
  const slogans = [
    t('One gateway. Every possibility.'),
    t('Switch models. Keep building.'),
    t('Connect once. Create without limits.'),
  ]
  const signature = slogans.join('\n')

  useEffect(() => {
    const lines = signature.split('\n')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setTimeout>
    let line = 0
    let length = 0
    let deleting = false
    function tick() {
      length += deleting ? -1 : 1
      setText(lines[line].slice(0, length))
      let delay = deleting ? 35 : 85
      if (length === lines[line].length) {
        deleting = true
        delay = 2400
      }
      if (length === 0) {
        deleting = false
        line = (line + 1) % lines.length
        delay = 350
      }
      timer = setTimeout(tick, delay)
    }
    function restart() {
      clearTimeout(timer)
      if (motion.matches) {
        setText(lines[0])
        return
      }
      line = 0
      length = 0
      deleting = false
      setText('')
      tick()
    }
    restart()
    motion.addEventListener('change', restart)
    return () => {
      clearTimeout(timer)
      motion.removeEventListener('change', restart)
    }
  }, [signature])

  return (
    <>
      <div className='pointer-events-none absolute inset-0 flex items-center justify-center px-5'>
        <div className='pointer-events-auto w-full max-w-[min(52vw,620px)] px-3 py-7 text-center text-white [text-shadow:0_2px_18px_#000] max-sm:max-w-[90vw] sm:px-6'>
          <img
            src='/home-globe/hcai-logo.png'
            alt='HCAI'
            width={1039}
            height={406}
            className='mx-auto mb-5 h-auto w-32 max-w-full object-contain sm:w-40 lg:w-48'
          />
          <h2
            className='flex min-h-[3em] items-center justify-center text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl'
            aria-label={slogans[0]}
          >
            <span aria-hidden='true'>
              {text}
              <span className='ml-1 inline-block h-[0.9em] w-0.5 bg-white/80 align-baseline' />
            </span>
          </h2>
          <div className='mt-1 flex flex-wrap justify-center gap-3'>
            <Button
              className='h-11 rounded-full bg-white px-6 text-black hover:bg-white/90'
              render={<Link to={isAuthenticated ? '/dashboard' : '/sign-in'} />}
            >
              {t('Try it now')}
            </Button>
            <Button
              variant='outline'
              className='h-11 rounded-full border-white/30 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white'
              onClick={() => setContactOpen(true)}
            >
              {t('Business cooperation')}
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        title={t('Business cooperation')}
        description={t('Scan with WeChat to discuss business cooperation.')}
        contentClassName='sm:max-w-sm'
      >
        <div className='mx-auto w-fit rounded-xl bg-white p-4'>
          <img
            src='/home-globe/business-wechat.png'
            alt={t('Business WeChat QR code')}
            width={392}
            height={394}
            className='h-auto w-full max-w-64'
          />
        </div>
      </Dialog>
    </>
  )
}
