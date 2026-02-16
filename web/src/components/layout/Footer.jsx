/**
 * 页脚与官网 openclawapi.ai 一致：品牌为 OpenClaw API，版权与链接统一。
 * Console 页面（有侧边栏）显示精简版页脚；非 Console 页面显示完整页脚。
 * 页脚始终在内容区域内，不与侧边栏重叠。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import CrabLogo from './CrabLogo';

const BRAND_NAME = 'OpenClaw API';

const FooterBar = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const isConsoleRoute = location.pathname.startsWith('/console');

  const customFooter = useMemo(
    () => (
      <footer
        className='border-t border-semi-color-border mt-auto shrink-0'
        style={{ background: 'var(--semi-color-bg-0)' }}
      >
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          {/* Full footer for non-console pages */}
          {!isConsoleRoute && (
            <div className='py-12 grid grid-cols-2 md:grid-cols-5 gap-8'>
              <div className='col-span-2 md:col-span-1'>
                <Link
                  to='/'
                  className='flex items-center gap-2.5 mb-4'
                >
                  <div
                    className='flex h-7 w-7 items-center justify-center rounded-md border'
                    style={{
                      backgroundColor: 'rgba(255, 77, 77, 0.1)',
                      borderColor: 'rgba(255, 77, 77, 0.2)',
                    }}
                  >
                    <CrabLogo className='h-4 w-4' style={{ color: 'var(--oc-brand)' }} />
                  </div>
                  <span className='text-sm font-semibold' style={{ color: 'var(--semi-color-text-0)' }}>
                    Open<span style={{ color: 'var(--oc-brand)' }}>Claw</span> API
                  </span>
                </Link>
                <p className='text-sm leading-relaxed' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>
                  {t('footer.brand_desc')}
                </p>
              </div>
              <div>
                <h4 className='text-sm font-semibold mb-4' style={{ color: 'var(--semi-color-text-0)' }}>{t('footer.product')}</h4>
                <ul className='space-y-2.5'>
                  <li><a href='https://openclawapi.ai/#models' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.models')}</a></li>
                  <li><a href='https://openclawapi.ai/#pricing' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.pricing')}</a></li>
                  <li><a href='https://openclawapi.ai/docs' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.docs')}</a></li>
                  <li><Link to='/' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.console')}</Link></li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-semibold mb-4' style={{ color: 'var(--semi-color-text-0)' }}>{t('footer.support')}</h4>
                <ul className='space-y-2.5'>
                  <li><a href='https://openclawapi.ai/#faq' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.faq')}</a></li>
                  <li><a href='mailto:support@openclawapi.ai' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.contact')}</a></li>
                  <li><a href='https://status.openclawapi.ai' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.status')}</a></li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-semibold mb-4' style={{ color: 'var(--semi-color-text-0)' }}>{t('footer.resource')}</h4>
                <ul className='space-y-2.5'>
                  <li><a href='https://openclawapi.ai/about' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.about')}</a></li>
                  <li><a href='https://openclawapi.ai/docs' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.blog')}</a></li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-semibold mb-4' style={{ color: 'var(--semi-color-text-0)' }}>{t('footer.legal')}</h4>
                <ul className='space-y-2.5'>
                  <li><a href='https://openclawapi.ai/terms' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.terms')}</a></li>
                  <li><a href='https://openclawapi.ai/privacy' target='_blank' rel='noopener noreferrer' className='text-sm transition-colors duration-200 hover:!text-[var(--oc-accent)]' style={{ color: 'var(--oc-brand)', opacity: 0.8 }}>{t('footer.privacy')}</a></li>
                </ul>
              </div>
            </div>
          )}

          {/* Copyright bar — always shown */}
          <div className={`${!isConsoleRoute ? 'border-t border-semi-color-border' : ''} py-5 flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <p className='text-xs' style={{ color: 'var(--semi-color-text-2)' }}>
              © {currentYear} {BRAND_NAME}. {t('footer.copyright')}
            </p>
            <div className='flex items-center gap-4'>
              <a href='https://github.com/openclawapi' target='_blank' rel='noopener noreferrer' className='hover:opacity-80 transition-opacity' style={{ color: 'var(--semi-color-text-2)' }} aria-label='GitHub'>
                <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 24 24'><path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' /></svg>
              </a>
              <a href='https://x.com/openclawapi' target='_blank' rel='noopener noreferrer' className='hover:opacity-80 transition-opacity' style={{ color: 'var(--semi-color-text-2)' }} aria-label='X'>
                <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 24 24'><path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    ),
    [t, currentYear, isConsoleRoute],
  );

  return customFooter;
};

export default FooterBar;
