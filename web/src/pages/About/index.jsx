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

import React, { useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

const About = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);
  const currentYear = new Date().getFullYear();

  const displayAbout = async () => {
    const cachedAbout = localStorage.getItem('about') || '';
    setAbout(cachedAbout);
    try {
      const res = await API.get('/api/about');
      const { success, message, data } = res.data;
      if (success) {
        let aboutContent = data || '';
        if (aboutContent && !aboutContent.startsWith('https://')) {
          aboutContent = marked.parse(aboutContent);
        }
        setAbout(aboutContent);
        localStorage.setItem('about', aboutContent);
      } else {
        showError(message);
        setAbout(cachedAbout || '');
      }
    } catch (error) {
      console.error('Failed to load about content', error);
      if (!cachedAbout) {
        setAbout('');
      }
    } finally {
      setAboutLoaded(true);
    }
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  const customDescription = (
    <div style={{ textAlign: 'center' }}>
      <p>{t('可在设置页面设置关于内容，支持 HTML & Markdown')}</p>
      {t('New API项目仓库地址：')}
      <a
        href='https://github.com/QuantumNous/new-api'
        target='_blank'
        rel='noopener noreferrer'
        className='text-primary'
      >
        https://github.com/QuantumNous/new-api
      </a>
      <p>
        <a
          href='https://github.com/QuantumNous/new-api'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          NewAPI
        </a>{' '}
        {t('© {{currentYear}}', { currentYear })}{' '}
        <a
          href='https://github.com/QuantumNous'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          QuantumNous
        </a>{' '}
        {t('| 基于')}{' '}
        <a
          href='https://github.com/songquanpeng/one-api/releases/tag/v0.5.4'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          One API v0.5.4
        </a>{' '}
        © 2023{' '}
        <a
          href='https://github.com/songquanpeng'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          JustSong
        </a>
      </p>
      <p>
        {t('本项目根据')}
        <a
          href='https://github.com/songquanpeng/one-api/blob/v0.5.4/LICENSE'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          {t('MIT许可证')}
        </a>
        {t('授权，需在遵守')}
        <a
          href='https://www.gnu.org/licenses/agpl-3.0.html'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          {t('AGPL v3.0协议')}
        </a>
        {t('的前提下使用。')}
      </p>
    </div>
  );

  return (
    <div className='mt-[60px] px-2'>
      {aboutLoaded && about === '' ? (
        <div className='flex justify-center items-center h-screen p-8'>
          <div className='glass-panel flex max-w-2xl flex-col items-center gap-5 rounded-[2rem] p-8 text-center'>
            <div className='flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary/10 text-primary'>
              <Construction size={44} />
            </div>
            <p className='text-base font-semibold text-slate-950 dark:text-white'>
              {t('管理员暂时未设置任何关于内容')}
            </p>
            {customDescription}
          </div>
        </div>
      ) : (
        <>
          {about.startsWith('https://') ? (
            <iframe
              src={about}
              style={{ width: '100%', height: '100vh', border: 'none' }}
            />
          ) : (
            <div
              style={{ fontSize: 'larger' }}
              dangerouslySetInnerHTML={{ __html: about }}
            ></div>
          )}
        </>
      )}
    </div>
  );
};

export default About;
