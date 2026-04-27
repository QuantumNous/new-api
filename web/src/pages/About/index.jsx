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
import {
  ArrowUpRight,
  ExternalLink,
  Github,
  Globe,
  Info,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { useNavigate } from 'react-router-dom';

const PAGE_SHELL =
  'mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8';

const About = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const isIframeUrl = about.startsWith('https://');

  // Project info section shared across the empty / fallback state.
  const renderProjectInfoCard = () => (
    <Card className='!rounded-2xl border-0 shadow-sm'>
      <Card.Content className='space-y-5 p-5 sm:p-6'>
        <div className='flex items-start gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <Info className='h-4 w-4' aria-hidden />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium text-foreground'>
              {t('可在设置页面设置关于内容，支持 HTML & Markdown')}
            </p>
            <p className='mt-1 text-xs text-muted'>
              {t('设置关于')} → /console/setting?tab=other
            </p>
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <ProjectLinkTile
            href='https://github.com/QuantumNous/new-api'
            icon={<Github className='h-4 w-4' aria-hidden />}
            title={t('关于项目')}
            subtitle='QuantumNous/new-api'
          />
          <ProjectLinkTile
            href='https://github.com/songquanpeng/one-api/releases/tag/v0.5.4'
            icon={<Sparkles className='h-4 w-4' aria-hidden />}
            title='One API v0.5.4'
            subtitle='songquanpeng/one-api'
          />
        </div>

        <div className='border-t border-[color:var(--app-border)] pt-4 text-xs leading-relaxed text-muted'>
          <p className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='font-medium text-primary hover:underline'
            >
              New API
            </a>
            <span>{t('© {{currentYear}}', { currentYear })}</span>
            <a
              href='https://github.com/QuantumNous'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              QuantumNous
            </a>
            <span aria-hidden>·</span>
            <span>
              {t('| 基于').trim()}{' '}
              <a
                href='https://github.com/songquanpeng'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                JustSong
              </a>{' '}
              (One API) © 2023
            </span>
          </p>
          <p className='mt-2'>
            {t('本项目根据')}
            <a
              href='https://github.com/songquanpeng/one-api/blob/v0.5.4/LICENSE'
              target='_blank'
              rel='noopener noreferrer'
              className='mx-0.5 text-primary hover:underline'
            >
              {t('MIT许可证')}
            </a>
            {t('授权，需在遵守')}
            <a
              href='https://www.gnu.org/licenses/agpl-3.0.html'
              target='_blank'
              rel='noopener noreferrer'
              className='mx-0.5 text-primary hover:underline'
            >
              {t('AGPL v3.0协议')}
            </a>
            {t('的前提下使用。')}
          </p>
        </div>
      </Card.Content>
    </Card>
  );

  if (!aboutLoaded) {
    return (
      <div
        className='flex min-h-[min(60dvh,32rem)] items-center justify-center'
        role='status'
        aria-label={t('加载中...')}
      >
        <Spinner size='lg' color='primary' />
      </div>
    );
  }

  if (about === '') {
    return (
      <div className={PAGE_SHELL}>
        <div className='space-y-4'>
          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='p-6 sm:p-10'>
              <EmptyState>
                <EmptyState.Header>
                  <EmptyState.Media variant='icon'>
                    <Info />
                  </EmptyState.Media>
                  <EmptyState.Title>{t('关于')}</EmptyState.Title>
                  <EmptyState.Description>
                    {t('管理员暂时未设置任何关于内容')}
                  </EmptyState.Description>
                </EmptyState.Header>
                <EmptyState.Content>
                  <Button
                    variant='tertiary'
                    onPress={() => navigate('/console/setting?tab=other')}
                  >
                    <Settings className='h-4 w-4' aria-hidden />
                    {t('设置关于')}
                  </Button>
                </EmptyState.Content>
              </EmptyState>
            </Card.Content>
          </Card>
          {renderProjectInfoCard()}
        </div>
      </div>
    );
  }

  if (isIframeUrl) {
    return (
      <div className={PAGE_SHELL}>
        <Card className='!rounded-2xl border-0 shadow-sm overflow-hidden'>
          <Card.Content className='space-y-3 p-3 sm:p-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex min-w-0 items-center gap-2'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <Globe className='h-4 w-4' aria-hidden />
                </div>
                <div className='min-w-0'>
                  <p className='text-xs text-muted'>
                    {t('管理员设置了外部链接，点击下方按钮访问')}
                  </p>
                  <p
                    className='truncate font-mono text-xs text-foreground'
                    title={about}
                  >
                    {about}
                  </p>
                </div>
              </div>
              <Button
                variant='tertiary'
                size='sm'
                onPress={() => window.open(about, '_blank', 'noopener,noreferrer')}
              >
                {t('在新标签页中打开')}
                <ArrowUpRight className='h-3.5 w-3.5' aria-hidden />
              </Button>
            </div>
            <div className='overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-background'>
              <iframe
                src={about}
                title={t('关于')}
                className='block h-[min(82dvh,52rem)] w-full border-0'
                loading='lazy'
                referrerPolicy='no-referrer-when-downgrade'
              />
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <Card className='!rounded-2xl border-0 shadow-sm overflow-hidden'>
        <Card.Content className='p-0'>
          <div className='flex items-center gap-2 border-b border-[color:var(--app-border)] px-5 py-3 sm:px-8'>
            <Chip size='sm' variant='tertiary' color='primary'>
              {t('关于')}
            </Chip>
          </div>
          <div
            className='about-prose prose prose-gray max-w-none px-5 py-8 prose-headings:scroll-mt-20 prose-a:text-primary prose-a:no-underline hover:prose-a:underline dark:prose-invert sm:px-8 sm:py-10 lg:prose-lg'
            dangerouslySetInnerHTML={{ __html: about }}
          />
        </Card.Content>
      </Card>
    </div>
  );
};

const ProjectLinkTile = ({ href, icon, title, subtitle }) => (
  <a
    href={href}
    target='_blank'
    rel='noopener noreferrer'
    className='group flex items-center gap-3 rounded-xl border border-[color:var(--app-border)] bg-background p-3.5 transition-colors hover:border-primary/40 hover:bg-surface-secondary/40'
  >
    <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary/60 text-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary'>
      {icon}
    </div>
    <div className='min-w-0 flex-1'>
      <div className='flex items-center gap-1.5 text-sm font-semibold text-foreground'>
        <span className='truncate'>{title}</span>
        <ExternalLink
          className='h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100'
          aria-hidden
        />
      </div>
      <p className='truncate text-xs text-muted'>{subtitle}</p>
    </div>
  </a>
);

export default About;
