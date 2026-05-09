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
import { getLogo } from '../../helpers';
import { useTranslation } from 'react-i18next';
import './Footer.css';

const Footer = () => {
  const { t } = useTranslation();
  const logo = getLogo();
  const footerLinks = {
    product: {
      title: t('产品'),
      links: [
        { label: t('API 文档'), href: '#' },
        { label: t('定价方案'), href: '#/pricing' },
        { label: t('模型广场'), href: '#' },
      ],
    },
    company: {
      title: t('公司'),
      links: [
        { label: t('关于我们'), href: '#' },
        { label: t('博客'), href: '#' },
        { label: t('联系我们'), href: '#' },
      ],
    },
    legal: {
      title: t('法律'),
      links: [
        { label: t('隐私政策'), href: '#' },
        { label: t('服务条款'), href: '#' },
        { label: t('Cookie 政策'), href: '#' },
      ],
    },
  };

  return (
    <footer className='site-footer'>
      <div className='site-footer-shell mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        <div className='site-footer-panel'>
          <div className='site-footer-grid grid grid-cols-1 gap-8 md:grid-cols-4'>
            <div className='site-footer-brand space-y-4'>
              <Link
                to='/'
                className='site-footer-brand-link flex items-center gap-2'
              >
                <div className='site-footer-brand-mark flex h-8 w-8 items-center justify-center rounded-lg'>
                  <img src={logo} alt='logo' />
                </div>
                <span className='site-footer-brand-name text-lg font-semibold'>
                  Z-UP API Platform
                </span>
              </Link>
              <p className='site-footer-brand-copy text-sm'>
                {t(
                  '企业级 AI API 网关，统一接入 GPT-5、Claude、Gemini 等 50+ 模型。',
                )}
              </p>
            </div>

            {Object.entries(footerLinks).map(([key, section]) => (
              <div key={key} className='site-footer-group'>
                <h3 className='site-footer-group-title mb-4 text-sm font-semibold'>
                  {section.title}
                </h3>
                <ul className='space-y-3'>
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className='site-footer-link text-sm'>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className='site-footer-bottom mt-12 flex items-center justify-between pt-8'>
            <p className='site-footer-copyright text-sm'>
              &copy; 2026 Z-UP API. {t('保留所有权利。')}
            </p>
            <div className='site-footer-status flex items-center gap-2 text-sm'>
              <span className='site-footer-status-dot flex h-2 w-2 rounded-full'></span>
              {t('所有系统正常运行')}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
