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
import {
  Network,
  Coins,
  Building2,
  ShieldCheck,
  Gauge,
  Receipt,
  Users,
  LineChart,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'access',
      num: '01',
      title: t('Unified model service access'),
      desc: t('Home feature model access description'),
      span: 'md:col-span-2',
      icon: <Network className='size-4 text-blue-400' />,
    },
    {
      id: 'token',
      num: '02',
      title: t('Unified token resource operations'),
      desc: t('Home feature token operations description'),
      span: 'md:col-span-1',
      icon: <Coins className='size-4 text-violet-400' />,
    },
    {
      id: 'tenant',
      num: '03',
      title: t('Tenant and application management'),
      desc: t('Home feature tenant management description'),
      span: 'md:col-span-1',
      icon: <Building2 className='size-4 text-purple-400' />,
    },
    {
      id: 'audit',
      num: '04',
      title: t('Call audit and operations monitoring'),
      desc: t('Home feature audit monitoring description'),
      span: 'md:col-span-2',
      icon: <ShieldCheck className='size-4 text-emerald-400' />,
    },
  ]

  const additionalFeatures = [
    {
      icon: <Gauge className='size-5 text-blue-400' strokeWidth={1.5} />,
      title: t('Home additional scheduling title'),
      desc: t('Home additional scheduling description'),
    },
    {
      icon: <Receipt className='size-5 text-violet-400' strokeWidth={1.5} />,
      title: t('Home additional billing title'),
      desc: t('Home additional billing description'),
    },
    {
      icon: <Users className='size-5 text-purple-400' strokeWidth={1.5} />,
      title: t('Home additional tenant title'),
      desc: t('Home additional tenant description'),
    },
    {
      icon: <LineChart className='size-5 text-emerald-400' strokeWidth={1.5} />,
      title: t('Home additional monitoring title'),
      desc: t('Home additional monitoring description'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='mb-3 text-xs font-medium tracking-widest text-violet-300/80 uppercase'>
            {t('Platform Core Capabilities')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight text-slate-50 md:text-3xl'>
            {t('Home features section title')}
          </h2>
        </AnimateInView>

        <div className='grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`group border-white/5 bg-slate-900/50 p-7 backdrop-blur-sm transition-colors duration-300 hover:bg-slate-800/60 md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10px] font-semibold text-slate-300 tabular-nums'>
                  {f.num}
                </span>
                <span className='text-violet-300/90'>{f.icon}</span>
                <h3 className='text-sm font-semibold text-slate-100'>
                  {f.title}
                </h3>
              </div>
              <p className='text-sm leading-relaxed text-slate-400'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>

        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='mb-3 flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors group-hover:border-violet-400/30'>
                {f.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold text-slate-100'>
                {f.title}
              </h3>
              <p className='max-w-[200px] text-xs leading-relaxed text-slate-400'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
