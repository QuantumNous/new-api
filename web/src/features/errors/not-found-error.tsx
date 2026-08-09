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
import { BookOpen, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function NotFoundError() {
  const { t } = useTranslation()

  return (
    <main
      data-landing-not-found
      className='flex min-h-svh w-full flex-col bg-white p-3 text-neutral-950 sm:p-4 lg:p-5'
    >
      <div className='mx-auto my-auto grid w-full max-w-[1600px] gap-3 sm:gap-4 lg:h-[min(50rem,calc(100svh-2.5rem))] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1.75fr)_minmax(20rem,0.75fr)] lg:gap-5'>
        <section
          aria-labelledby='not-found-title'
          className='relative flex min-h-80 min-w-0 overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white sm:min-h-96 sm:p-8 lg:min-h-0 lg:rounded-[2rem] lg:p-10 xl:p-12'
        >
          <div aria-hidden='true' className='absolute inset-0 overflow-hidden'>
            <div className='absolute -top-28 -right-20 size-72 rounded-full bg-blue-600/35 blur-3xl sm:size-96' />
            <div className='absolute right-[28%] bottom-[-12rem] size-96 rounded-full bg-blue-500/25 blur-3xl' />
            <div className='absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.12)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom_right,black,transparent_75%)] bg-[size:24px_24px]' />
          </div>
          <h1
            id='not-found-title'
            className='relative z-10 mt-auto text-xl leading-[1.08] font-bold tracking-normal sm:text-2xl'
          >
            <span className='block'>404 NotFound</span>
            <span className='mt-1 block'>{t('Oops! Page Not Found!')}</span>
          </h1>
        </section>

        <nav
          aria-label={t('Quick Links')}
          className='grid grid-rows-2 gap-3 sm:gap-4 lg:min-h-0 lg:gap-5'
        >
          <a
            href='/'
            aria-label={t('Back to Home')}
            className='group relative flex min-h-44 overflow-hidden rounded-3xl bg-blue-600 p-5 text-white transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none focus-visible:ring-inset sm:min-h-48 sm:p-6 lg:min-h-0 lg:rounded-[2rem] lg:p-7 xl:p-8'
          >
            <div className='flex size-full flex-col justify-between'>
              <Home
                aria-hidden='true'
                className='size-7 sm:size-8 lg:size-10'
                strokeWidth={1.7}
              />
              <div className='pt-5 text-left'>
                <span className='text-lg leading-tight font-bold sm:text-xl lg:text-2xl'>
                  {t('Back to Home')}
                </span>
              </div>
            </div>
          </a>
          <a
            href='/docs/'
            aria-label={t('Docs')}
            className='group relative flex min-h-44 overflow-hidden rounded-3xl bg-teal-500 p-5 text-white transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none focus-visible:ring-inset sm:min-h-48 sm:p-6 lg:min-h-0 lg:rounded-[2rem] lg:p-7 xl:p-8'
          >
            <div className='flex size-full flex-col justify-between'>
              <BookOpen
                aria-hidden='true'
                className='size-7 sm:size-8 lg:size-10'
                strokeWidth={1.7}
              />
              <div className='pt-5 text-left'>
                <span className='text-lg leading-tight font-bold sm:text-xl lg:text-2xl'>
                  {t('Docs')}
                </span>
              </div>
            </div>
          </a>
        </nav>
      </div>
    </main>
  )
}
