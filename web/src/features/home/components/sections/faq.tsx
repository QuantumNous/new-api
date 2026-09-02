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
import { MessageCircleHeart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll'

export function FAQ() {
  const { t } = useTranslation()
  const sectionRef = useRevealOnScroll<HTMLElement>()

  const faqs = [
    {
      q: t('I have zero technical background. Can I really use this?'),
      a: t(
        'Absolutely. You never touch code — just copy an address and a key into your tool, like filling in a Wi-Fi password. Our step-by-step guide covers every popular tool with screenshots.'
      ),
    },
    {
      q: t('What exactly is a "key"?'),
      a: t(
        'A key is a long password that starts with "sk-". It tells your AI tool who you are, so usage is billed to your account. Keep it private, like a bank card number.'
      ),
    },
    {
      q: t('Which AI models can I use?'),
      a: t(
        'All the big names: GPT, Claude, Gemini, DeepSeek, Qwen and many more — over a hundred models through the same key. Switch between them freely inside your tool.'
      ),
    },
    {
      q: t('How does billing work?'),
      a: t(
        'Pay as you go: you only pay for what you actually use, billed per request. No monthly fees. You can set a spending cap on each key, so there are never surprises.'
      ),
    },
    {
      q: t('My tool says "connection failed". What do I do?'),
      a: t(
        'Nine times out of ten it is a small typo — an extra space in the key, or the wrong address format. Open the in-site guide and check the troubleshooting table; it lists every common error and its one-line fix.'
      ),
    },
  ]

  return (
    <section ref={sectionRef} className='relative z-10 px-6 py-16 md:py-24'>
      <div className='dopa-section-shell' data-section='HELP'>
        <div className='grid gap-9 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14'>
          <div className='dopa-reveal'>
            <p className='dopa-section-kicker'>{t('FAQ')}</p>
            <h2 className='mt-4 text-3xl font-black tracking-[-0.055em] text-balance md:text-5xl'>
              {t('Questions? We got you')}
            </h2>
            <p className='text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed'>
              {t('If you can copy and paste, you can do this.')}
            </p>
          </div>

          <div className='dopa-progressive-panel dopa-reveal dopa-paper rounded-[1.75rem] px-6 py-2 md:px-8'>
            <Accordion>
              {faqs.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className='py-5 text-base font-semibold hover:no-underline'>
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className='text-muted-foreground pb-5 text-sm leading-relaxed'>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className='dopa-reveal dopa-paper mt-7 grid overflow-hidden rounded-[1.75rem] md:grid-cols-[1fr_240px]'>
          <div className='flex flex-col justify-center px-7 py-8 md:px-9'>
            <span className='bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl'>
              <MessageCircleHeart className='size-6' />
            </span>
            <p className='text-primary mt-5 text-sm font-bold'>
              {t('After-sales support community')}
            </p>
            <h3 className='mt-2 text-2xl font-extrabold tracking-tight'>
              {t('Need help? Join our QQ group')}
            </h3>
            <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
              {t(
                'Scan the QR code to join the ds relay after-sales group for setup help, troubleshooting, and usage questions.'
              )}
            </p>
            <p className='mt-4 text-sm font-bold'>
              {t('QQ group: 1065665694')}
            </p>
          </div>

          <div className='bg-primary/6 flex items-center justify-center border-t border-[var(--dopa-rule)] p-5 md:border-t-0 md:border-l'>
            <img
              src='/qq-community-qr.png'
              alt={t('QQ after-sales group QR code')}
              width={860}
              height={860}
              className='aspect-square w-full max-w-[200px] bg-white'
            />
          </div>
        </div>
      </div>
    </section>
  )
}
