import React from 'react';
import { Link } from 'react-router-dom';
import { getLogo } from '../../helpers';
import './Footer.css';

const Footer = () => {
  const logo = getLogo();
  const footerLinks = {
    product: {
      title: '产品',
      links: [
        { label: 'API 文档', href: '#' },
        { label: '定价方案', href: '#/pricing' },
        { label: '模型广场', href: '#' },
      ],
    },
    company: {
      title: '公司',
      links: [
        { label: '关于我们', href: '#' },
        { label: '博客', href: '#' },
        { label: '联系我们', href: '#' },
      ],
    },
    legal: {
      title: '法律',
      links: [
        { label: '隐私政策', href: '#' },
        { label: '服务条款', href: '#' },
        { label: 'Cookie 政策', href: '#' },
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
                企业级 AI API 网关，统一接入 GPT-5、Claude、Gemini 等 50+ 模型。
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
              &copy; 2026 Z-UP API. 保留所有权利。
            </p>
            <div className='site-footer-status flex items-center gap-2 text-sm'>
              <span className='site-footer-status-dot flex h-2 w-2 rounded-full'></span>
              所有系统正常运行
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
