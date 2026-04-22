/*
Copyright (C) 2025 QuantumNous

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

import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ChevronRight,
  Coins,
  Lock,
  Receipt,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  defaultHeroModelCards,
  modelGroups,
  promiseItems,
  shouldRenderDefaultHomePage,
  trustMetrics,
  trustQuoteKey,
  getDefaultHomePageLocaleAdjustments,
} from './homeSections';

const homeText = {
  badge: '\u65e0\u9650\u661f\u6cb3 AI \u00b7 \u8ba9\u521b\u9020\u66f4\u7b80\u5355',
  titleHtml: 'hero-title',
  subtitle:
    '\u5bf9\u6807\u5b98\u65b9\u4ef7\u683c\u3001\u660e\u793a\u51e0\u6298\uff1b\u5168\u94fe\u8def\u771f\u5b9e\u6027\u68c0\u6d4b\uff1b\n\u4e2a\u4eba\u3001\u5f00\u53d1\u8005\u3001\u4f01\u4e1a\u90fd\u6709\u5bf9\u5e94\u7684\u5f00\u901a\u8def\u5f84\u3002',
  primaryCta: '\u7acb\u5373\u5f00\u59cb',
  primaryConsole: '\u8fdb\u5165\u63a7\u5236\u53f0',
  pricingCta: '\u67e5\u770b\u4ef7\u683c',
  enterpriseCta: '\u6211\u662f\u4f01\u4e1a\u7528\u6237',
  baseUrlTitle: '\u4e00\u952e\u590d\u5236\u53ef\u76f4\u63a5\u63a5\u5165\u7684\u57fa\u7840\u5730\u5740',
  copyBaseUrl: '\u590d\u5236\u5730\u5740',
  floatingTag: '\u6a21\u578b\u8986\u76d6',
  floatingValue: '\u4e3b\u6d41\u5168\u8986\u76d6',
  coverageTitle: '\u4e3b\u6d41\u6a21\u578b\u8986\u76d6',
  modelsTitle: '\u4f60\u8981\u7684\u6a21\u578b\uff0c\u8fd9\u91cc\u5168\u90fd\u6709',
  modelsSubtitle: '\u8986\u76d6\u5168\u90e8\u4e3b\u6d41\u6a21\u578b\uff0c\u9996\u53d1\u540c\u6b65\u6700\u65b0\u7248\u672c\u3002',
  ctaTitleLine1: '\u5927\u58f0\u544a\u8bc9\u4f60\uff0c',
  ctaTitleLine2: '\u6211\u4eec\u5c31\u662f\u4e00\u4e2a\u8ba4\u771f\u505a\u670d\u52a1\u7684\u5e73\u53f0\u3002',
  ctaDesc:
    '\u6ca1\u6709\u82b1\u91cc\u80e1\u54e8\u7684\u5657\u5934\uff0c\u6ca1\u6709\u6587\u5b57\u6e38\u620f\u3002\u53ea\u628a\u6a21\u578b\u771f\u5b9e\u3001\u4ef7\u683c\u900f\u660e\u3001\u4f01\u4e1a\u53ef\u7528\u505a\u5230\u4f4d\u3002',
  ctaButton: '\u7acb\u5373\u5f00\u59cb\u6ce8\u518c',
  footerBrand: '\u65e0\u9650\u661f\u6cb3 AI',
  footerDesc:
    '\u8ba9\u6700\u9876\u5c16\u7684 AI \u6a21\u578b\uff0c\u4ee5\u66f4\u900f\u660e\u3001\u53ef\u4fe1\u3001\u4f4e\u6210\u672c\u7684\u65b9\u5f0f\u89e6\u8fbe\u6bcf\u4e00\u4f4d\u8ba4\u771f\u7684\u4ea7\u54c1\u4eba\u4e0e\u5f00\u53d1\u8005\u3002',
  footerTitle: '\u4ea7\u54c1\u4e0e\u6587\u6863',
  footerModels: '\u6a21\u578b\u8986\u76d6\u77e9\u9635',
  footerDocs: '\u6587\u6863',
  footerCopy: 'footer-copy',
  footerVersion: '\u5f53\u524d\u7248\u672c v2026.04 \u00b7 \u6700\u540e\u66f4\u65b0 2026-04-14',
};

const homepageLogo = '/logo.png';

const promiseIconMap = {
  'shield-check': ShieldCheck,
  coins: Coins,
  lock: Lock,
  zap: Zap,
  receipt: Receipt,
  building: Building2,
};

const DefaultHomePage = ({
  t,
  docsLink,
  isDemoSiteMode,
}) => {
  const { i18n } = useTranslation();
  const primaryLink = isDemoSiteMode ? '/console' : '/register';
  const enterpriseLink = docsLink || '/pricing';
  const docsHref = docsLink || '/docs';
  const localeAdjustments = getDefaultHomePageLocaleAdjustments(i18n.language);

  return (
    <main id='homepage' data-homepage-default='true' className='pt-[60px]'>
      <section className='relative pt-20 pb-32 overflow-hidden bg-[#FAFAFB]'>
        <div className='absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/60 rounded-full blur-[120px] pointer-events-none -translate-y-1/3 translate-x-1/4' />

        <div className='relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-12'>
          <div className='lg:col-span-7 lg:pt-10'>
            <span className='inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-indigo-100 text-indigo-600 text-xs font-bold mb-8 shadow-sm'>
              <span className='mr-2 h-2 w-2 animate-pulse rounded-full bg-indigo-500' />
              {t(homeText.badge)}
            </span>
            <h1
              className='mb-6 text-[44px] font-black leading-[1.15] tracking-tight text-gray-900 lg:text-[64px]'
              dangerouslySetInnerHTML={{ __html: t(homeText.titleHtml) }}
            />
            <p className='mb-10 max-w-2xl whitespace-pre-line text-lg font-medium leading-relaxed text-gray-500 lg:text-xl'>
              {t(homeText.subtitle)}
            </p>
            <div className='flex flex-wrap gap-4'>
              <Link
                to={primaryLink}
                className='btn-primary rounded-2xl px-8 py-4 text-lg font-bold'
              >
                {t(isDemoSiteMode ? homeText.primaryConsole : homeText.primaryCta)}
              </Link>
              <Link
                to='/pricing'
                className='rounded-2xl border border-gray-200 bg-white px-8 py-4 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-50'
              >
                {t(homeText.pricingCta)}
              </Link>
              {docsLink ? (
                <a
                  href={enterpriseLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='ml-2 inline-flex items-center font-bold text-indigo-600 transition-colors hover:text-indigo-700'
                >
                  {t(homeText.enterpriseCta)}
                  <ChevronRight size={18} className='ml-1' />
                </a>
              ) : (
                <Link
                  to='/pricing'
                  className='ml-2 inline-flex items-center font-bold text-indigo-600 transition-colors hover:text-indigo-700'
                >
                  {t(homeText.enterpriseCta)}
                  <ChevronRight size={18} className='ml-1' />
                </Link>
              )}
            </div>
          </div>

          <div className='relative mt-10 lg:col-span-5 lg:mt-0'>
            <div className={`home-floating-card ${localeAdjustments.floatingCardClass}`}>
              <div className='mb-1 text-[10px] uppercase tracking-widest text-gray-400'>
                {t(homeText.floatingTag)}
              </div>
              <div className='text-2xl'>{t(homeText.floatingValue)}</div>
            </div>

            <div className='glass-card ml-auto max-w-[420px] rounded-[32px] bg-white/80 p-6 shadow-[0_24px_48px_-18px_rgba(79,70,229,0.12)] transition-transform duration-500 hover:rotate-0 lg:-rotate-1 lg:p-7'>
              <div className='mb-5 border-b border-gray-100 pb-4'>
                <div className='mb-2 flex items-center gap-3'>
                  <div className='flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600'>
                    <Sparkles size={16} />
                  </div>
                  <span className='text-xs font-black uppercase tracking-widest text-gray-400'>
                    {t('Model Coverage')}
                  </span>
                </div>
                <h3 className='text-2xl font-black tracking-tight text-gray-900'>
                  {t(homeText.coverageTitle)}
                </h3>
              </div>
              <div className='space-y-3'>
                {defaultHeroModelCards.map((item) => (
                  <div
                    key={item.vendor}
                    className='rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4'
                  >
                    <div className='mb-1.5 text-xs font-black uppercase tracking-widest text-gray-400'>
                      {item.vendor}
                    </div>
                    <div className='font-bold text-gray-900'>{item.model}</div>
                    <div className='mt-1 text-xs font-medium text-gray-400'>
                      {t(item.descKey)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className='border-y border-gray-100 bg-white py-12'>
        <div className={localeAdjustments.trustMetricsContainerClass}>
          {trustMetrics.map((metric) => (
            <span
              key={metric.key}
              className={localeAdjustments.trustMetricClass}
            >
              {t(metric.textKey)}
            </span>
          ))}
        </div>
        <p className='mt-8 text-center text-xs font-bold uppercase tracking-widest text-gray-400'>
          {t(trustQuoteKey)}
        </p>
      </div>

      <section id='promises' className='bg-[#FAFAFB] py-24'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
            {promiseItems.map((item) => {
              const Icon = promiseIconMap[item.icon];
              return (
                <article
                  key={item.key}
                  data-home-promise={item.key}
                  className='card-hover rounded-3xl border border-gray-100 bg-white p-8 transition-all'
                >
                  <h3 className='mb-3 flex items-center gap-3 text-xl font-bold text-gray-900'>
                    <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white'>
                      <Icon size={20} />
                    </span>
                    <span>{t(item.titleKey)}</span>
                  </h3>
                  <p className='text-sm leading-relaxed text-gray-500'>
                    {t(item.descKey)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id='models' className='bg-white py-24'>
        <div className='mx-auto max-w-7xl px-6 text-center'>
          <h2 className='mb-4 text-3xl font-black text-gray-900 lg:text-4xl'>
            {t(homeText.modelsTitle)}
          </h2>
          <p className='mb-16 font-medium text-gray-500'>
            {t(homeText.modelsSubtitle)}
          </p>

          <div className='grid grid-cols-1 gap-8 md:grid-cols-3'>
            {modelGroups.map((group) => (
              <article
                key={group.key}
                className='rounded-[32px] border border-gray-100 bg-[#FAFAFB] p-8 text-left'
              >
                <div className='mb-8 flex items-center justify-between'>
                  <span className='text-2xl font-black text-gray-900'>
                    {group.title}
                  </span>
                  <span className='rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-gray-600'>
                    {group.vendor}
                  </span>
                </div>
                <div className='space-y-6 font-bold text-gray-900'>
                  {group.models.map((model, index) => (
                    <div
                      key={model}
                      className={
                        index < group.models.length - 1
                          ? 'border-b border-gray-200 pb-4'
                          : ''
                      }
                    >
                      {model}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id='cta' className='border-t border-gray-100 bg-[#FAFAFB] py-32'>
        <div className='mx-auto max-w-4xl px-6 text-center'>
          <h2 className='mb-6 text-3xl font-black leading-tight text-gray-900 lg:text-5xl'>
            {t(homeText.ctaTitleLine1)}
            <br />
            {t(homeText.ctaTitleLine2)}
          </h2>
          <p className='mx-auto mb-10 max-w-2xl text-lg font-medium text-gray-500'>
            {t(homeText.ctaDesc)}
          </p>
          <div className='flex flex-wrap justify-center gap-4'>
            <Link
              to={primaryLink}
              className='btn-primary rounded-2xl px-10 py-4 text-lg font-bold shadow-xl'
            >
              {t(isDemoSiteMode ? homeText.primaryConsole : homeText.ctaButton)}
            </Link>
          </div>
        </div>
      </section>

      <footer className='border-t border-gray-200 bg-[#FAFAFB] pb-10 pt-20'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mb-16 grid grid-cols-1 items-start gap-10 md:grid-cols-2'>
            <div>
              <div className='mb-4 flex items-center gap-2 text-lg font-bold text-gray-900'>
                <img
                  src={homepageLogo}
                  alt={t(homeText.footerBrand)}
                  className='h-6 w-6 rounded-md object-contain'
                />
                {t(homeText.footerBrand)}
              </div>
              <p className='max-w-xs text-sm font-medium leading-relaxed text-gray-500'>
                {t(homeText.footerDesc)}
              </p>
            </div>
            <div>
              <h4 className='mb-5 font-bold text-gray-900'>
                {t(homeText.footerTitle)}
              </h4>
              <ul className='space-y-3 text-sm font-medium text-gray-500'>
                <li>
                  <a href='#models' className='transition-colors hover:text-indigo-600'>
                    {t(homeText.footerModels)}
                  </a>
                </li>
                <li>
                  <a
                    href={docsHref}
                    target={docsHref.startsWith('http') ? '_blank' : undefined}
                    rel={
                      docsHref.startsWith('http')
                        ? 'noopener noreferrer'
                        : undefined
                    }
                    className='transition-colors hover:text-indigo-600'
                  >
                    {t(homeText.footerDocs)}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className='flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 text-xs font-bold uppercase tracking-wide text-gray-400 md:flex-row'>
            <span className='text-center md:text-left'>
              {t(homeText.footerCopy)}
            </span>
            <span>{t(homeText.footerVersion)}</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export { shouldRenderDefaultHomePage };
export default DefaultHomePage;
