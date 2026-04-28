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
import {
  Building2,
  Coins,
  Lock,
  Receipt,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { promiseItems, shouldRenderDefaultHomePage } from './homeSections';

const homeText = {
  badge:
    '\u65e0\u9650\u661f\u6cb3 AI \u00b7 \u8ba9\u521b\u9020\u66f4\u7b80\u5355',
  titleHtml: 'hero-title',
  subtitle:
    '\u5bf9\u6807\u5b98\u65b9\u4ef7\u683c\u3001\u660e\u793a\u51e0\u6298\uff1b\u5168\u94fe\u8def\u771f\u5b9e\u6027\u68c0\u6d4b\uff1b\n\u4e2a\u4eba\u3001\u5f00\u53d1\u8005\u3001\u4f01\u4e1a\u90fd\u6709\u5bf9\u5e94\u7684\u5f00\u901a\u8def\u5f84\u3002',
  primaryCta: '\u7acb\u5373\u5f00\u59cb',
  primaryConsole: '\u8fdb\u5165\u63a7\u5236\u53f0',
  pricingCta: '\u67e5\u770b\u4ef7\u683c',
  baseUrlTitle:
    '\u4e00\u952e\u590d\u5236\u53ef\u76f4\u63a5\u63a5\u5165\u7684\u57fa\u7840\u5730\u5740',
  copyBaseUrl: '\u590d\u5236\u5730\u5740',
  modelsTitle:
    '\u4f60\u8981\u7684\u6a21\u578b\uff0c\u8fd9\u91cc\u5168\u90fd\u6709',
  modelsSubtitle:
    '\u8986\u76d6\u5168\u90e8\u4e3b\u6d41\u6a21\u578b\uff0c\u9996\u53d1\u540c\u6b65\u6700\u65b0\u7248\u672c\u3002',
  ctaTitle:
    '\u4e00\u4e2a\u8ba4\u771f\u505a\u670d\u52a1\u7684\u5e73\u53f0\u3002',
  ctaDesc:
    '\u6ca1\u6709\u82b1\u91cc\u80e1\u54e8\u7684\u5671\u5934\uff0c\u6ca1\u6709\u6587\u5b57\u6e38\u620f\u3002\u53ea\u628a\u6a21\u578b\u771f\u5b9e\u3001\u4ef7\u683c\u900f\u660e\u3001\u4f01\u4e1a\u53ef\u7528\u505a\u5230\u4f4d\u3002',
  ctaButton: '\u7acb\u5373\u5f00\u59cb\u6ce8\u518c',
  footerBrand: '\u65e0\u9650\u661f\u6cb3 AI',
  footerDesc:
    '\u8ba9\u6700\u9876\u5c16\u7684 AI \u6a21\u578b\uff0c\u4ee5\u66f4\u900f\u660e\u3001\u53ef\u4fe1\u3001\u4f4e\u6210\u672c\u7684\u65b9\u5f0f\u89e6\u8fbe\u6bcf\u4e00\u4f4d\u8ba4\u771f\u7684\u4ea7\u54c1\u4eba\u4e0e\u5f00\u53d1\u8005\u3002',
  footerTitle: '\u4ea7\u54c1\u4e0e\u6587\u6863',
  footerModels: '\u6a21\u578b\u8986\u76d6\u77e9\u9635',
  footerDocs: '\u6587\u6863',
  footerCopy: 'footer-copy',
  footerVersion:
    '\u5f53\u524d\u7248\u672c v2026.04 \u00b7 \u6700\u540e\u66f4\u65b0 2026-04-14',
};

const homepageLogo = '/logo.png';

const modelLogoRows = [
  [
    { key: 'openai', name: 'OpenAI', file: 'OpenAI.svg', featured: true },
    { key: 'claude', name: 'Claude', file: 'Claude.svg', featured: true },
    { key: 'gemini', name: 'Gemini', file: 'Gemini.svg', featured: true },
    { key: 'deepseek', name: 'DeepSeek', file: 'DeepSeek.svg' },
    { key: 'qwen', name: 'Qwen', file: 'Qwen.svg' },
    { key: 'zhipu', name: 'Zhipu', file: 'Zhipu.svg' },
    { key: 'hunyuan', name: 'Hunyuan', file: 'Hunyuan.svg' },
  ],
  [
    { key: 'midjourney', name: 'Midjourney', file: 'Midjourney.svg' },
    { key: 'moonshot', name: 'MoonshotAI', file: 'MoonshotAI.svg' },
    { key: 'volcengine', name: 'Volcengine', file: 'Volcengine.svg' },
    { key: 'wenxin', name: 'Wenxin', file: 'Wenxin.svg' },
    { key: 'grok', name: 'Grok', file: 'Grok_2.svg' },
    { key: 'more', name: '\u66f4\u591a\u6a21\u578b', count: '30+' },
  ],
];

const mobileModelLogoItems = [
  ...modelLogoRows[0].slice(0, 4),
  modelLogoRows[1][5],
];

const darkModelLogoFiles = new Set([
  'Grok_2.svg',
  'Midjourney.svg',
  'MoonshotAI.svg',
  'OpenAI.svg',
]);

const getDarkModelLogoFile = (file) => {
  if (!file || !darkModelLogoFiles.has(file)) {
    return null;
  }
  return file.replace(/\.svg$/, '-dark.svg');
};

const ModelLogoImage = ({ item, className }) => {
  const darkFile = getDarkModelLogoFile(item.file);

  return (
    <>
      <img
        src={`/model-logos/${item.file}`}
        alt={item.name}
        className={`${className} home-model-logo ${
          darkFile ? 'home-model-logo-light' : ''
        }`}
      />
      {darkFile ? (
        <img
          src={`/model-logos/${darkFile}`}
          alt=''
          aria-hidden='true'
          className={`${className} home-model-logo home-model-logo-dark`}
        />
      ) : null}
    </>
  );
};

const trustCards = [
  {
    key: 'calls',
    titleKey: '百万亿级调用规模',
    descKey: '稳定承载高并发调用，峰值场景下也能保持流畅返回。',
  },
  {
    key: 'builders',
    titleKey: '30W+ 产品人信任',
    descKey: '持续服务个人创作者、开发者与团队用户，口碑沉淀更真实。',
  },
  {
    key: 'invoice',
    titleKey: '增值税专用发票',
    descKey: '支持规范开票与企业对公流程，采购、报销与财务处理更省事。',
  },
  {
    key: 'compliance',
    titleKey: 'ICP备案 / EDI许可',
    descKey: '面向企业接入更友好，便于采购评估、合作推进与内部合规流转。',
  },
];

const promiseIconMap = {
  'shield-check': ShieldCheck,
  coins: Coins,
  lock: Lock,
  zap: Zap,
  receipt: Receipt,
  building: Building2,
};

const DefaultHomePage = ({ t, docsLink, isDemoSiteMode }) => {
  const primaryLink = isDemoSiteMode ? '/console' : '/register';
  const docsHref = docsLink || 'https://doc.infistar.ai/';

  return (
    <main id='homepage' data-homepage-default='true' className='header-offset-padding-top'>
      <section className='relative overflow-hidden bg-[#FAFAFB] pb-32 pt-14'>
        <div className='home-hero-glow pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] -translate-y-1/3 translate-x-1/4 rounded-full bg-indigo-100/60 blur-[120px]' />

        <div className='relative z-10 mx-auto max-w-7xl px-6'>
          <div className='pt-6'>
            <span
              className='home-hero-badge mb-8 inline-flex items-center rounded-full border border-indigo-100 bg-white px-5 py-2 text-sm font-bold shadow-sm'
              style={{ color: 'rgb(99 102 241 / var(--tw-bg-opacity, 1))' }}
            >
              <span className='home-hero-badge-dot mr-2.5 h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500' />
              {t(homeText.badge)}
            </span>

            <div className='grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1.35fr)_auto] lg:gap-10'>
              <div>
                <h1
                  className='text-[44px] font-black leading-[1.08] tracking-tight text-gray-900 lg:text-[64px]'
                  dangerouslySetInnerHTML={{ __html: t(homeText.titleHtml) }}
                />
              </div>

              <div className='flex flex-col items-start gap-4 lg:items-end lg:pb-2'>
                <div className='flex flex-wrap justify-start gap-4 lg:justify-end'>
                  <Link
                    to={primaryLink}
                    className='btn-primary rounded-2xl px-8 py-4 text-lg font-bold'
                  >
                    {t(
                      isDemoSiteMode
                        ? homeText.primaryConsole
                        : homeText.primaryCta,
                    )}
                  </Link>
                  <Link
                    to='/pricing'
                    className='rounded-2xl border border-gray-200 bg-white px-8 py-4 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-50'
                  >
                    {t(homeText.pricingCta)}
                  </Link>
                </div>
              </div>
            </div>

            <p className='mt-8 max-w-5xl text-lg font-medium leading-relaxed text-gray-500 lg:text-xl'>
              {t(homeText.subtitle)}
            </p>
          </div>
        </div>
      </section>

      <section className='overflow-hidden border-y border-gray-100 bg-white py-16'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='grid grid-cols-1 items-start gap-8 lg:grid-cols-3'>
            <div className='flex h-full flex-col items-center justify-center py-4 text-center'>
              <div className='flex items-end justify-center gap-3'>
                <span className='text-gradient text-6xl font-black leading-none lg:text-7xl'>
                  99.9%
                </span>
                <p className='home-trust-title pb-2 text-2xl font-black tracking-tight text-[#030712] lg:text-[28px]'>
                  {t('可用承诺')}
                </p>
              </div>
              <p className='mt-6 max-w-[320px] text-sm leading-7 text-gray-500'>
                {t(
                  '面向个人与团队用户，保障接口稳定、调用顺畅，日常使用更省心。',
                )}
              </p>
            </div>

            <div className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-2 lg:gap-8'>
              {trustCards.map((item) => (
                <div
                  key={item.key}
                  className='card-hover home-trust-card relative min-h-[164px] overflow-hidden rounded-[32px] px-8 py-6 transition-all'
                >
                  <p className='home-trust-title relative z-10 max-w-[210px] text-[24px] font-black leading-[1.18] tracking-tight text-[#030712]'>
                    {t(item.titleKey)}
                  </p>
                  <p className='home-trust-desc relative z-10 mt-5 max-w-[265px] text-[15px] font-medium leading-7 text-[#AAB4C8]'>
                    {t(item.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id='promises' className='bg-[#FAFAFB] py-24'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
            {promiseItems.map((item) => {
              const Icon = promiseIconMap[item.icon];
              return (
                <article
                  key={item.key}
                  data-home-promise={item.key}
                  className='card-hover home-promise-card rounded-3xl bg-white p-8 transition-all'
                >
                  <h3 className='mb-3 flex items-center gap-3 text-xl font-bold text-gray-900'>
                    <span className='home-promise-icon flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white'>
                      <Icon size={20} strokeWidth={1.8} />
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

      <section id='models' className='overflow-hidden bg-white py-20'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mx-auto mb-14 max-w-3xl text-center'>
            <h2 className='text-3xl font-black text-gray-900 lg:text-4xl'>
              {t(homeText.modelsTitle)}
            </h2>
            <p className='mt-4 font-medium text-gray-500'>
              {t(homeText.modelsSubtitle)}
            </p>
          </div>

          <div className='mx-auto max-w-6xl'>
            <div className='hidden lg:block'>
              <div className='grid justify-center gap-y-1'>
                {modelLogoRows.map((row, rowIndex) => (
                  <div
                    key={`model-row-${rowIndex}`}
                    className='flex justify-center gap-8'
                  >
                    {row.map((item) => (
                      <div key={item.key} className='home-model-diamond'>
                        <div className='home-model-diamond-inner'>
                          {item.file ? (
                            <ModelLogoImage
                              item={item}
                              className='h-10 w-10 object-contain'
                            />
                          ) : (
                            <span className='text-gradient text-[28px] font-black leading-none'>
                              {item.count}
                            </span>
                          )}
                          <div
                            className={`mt-3 text-sm leading-none ${
                              item.featured
                                ? 'font-black text-gray-900'
                                : 'font-bold text-gray-700'
                            }`}
                          >
                            {item.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className='grid grid-cols-3 justify-items-center gap-x-4 gap-y-6 sm:grid-cols-4 lg:hidden'>
              {mobileModelLogoItems.map((item) => (
                <div
                  key={`mobile-${item.key}`}
                  className='home-model-diamond home-model-diamond-mobile'
                >
                  <div className='home-model-diamond-inner home-model-diamond-inner-mobile'>
                    {item.file ? (
                      <ModelLogoImage
                        item={item}
                        className='h-8 w-8 object-contain'
                      />
                    ) : (
                      <span className='text-gradient text-2xl font-black leading-none'>
                        {item.count}
                      </span>
                    )}
                    <div
                      className={`mt-2 text-xs ${
                        item.featured
                          ? 'font-black text-gray-900'
                          : 'font-bold text-gray-700'
                      }`}
                    >
                      {item.key === 'more' ? '\u66f4\u591a' : item.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id='cta' className='border-t border-gray-100 bg-[#FAFAFB] py-32'>
        <div className='mx-auto max-w-4xl px-6 text-center'>
          <h2 className='mb-6 text-3xl font-black leading-tight text-gray-900 lg:text-5xl'>
            {t(homeText.ctaTitle)}
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

      <footer className='border-t border-gray-200 bg-white pb-10 pt-20'>
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
                  <a
                    href='/pricing'
                    className='transition-colors hover:text-indigo-600'
                  >
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
          </div>
        </div>
      </footer>
    </main>
  );
};

export { shouldRenderDefaultHomePage };
export default DefaultHomePage;
