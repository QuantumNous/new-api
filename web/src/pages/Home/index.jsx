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

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Typography,
  ScrollList,
  ScrollItem,
} from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconGithubLogo,
  IconPlay,
  IconFile,
  IconCopy,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const PROVIDER_LOGOS = [
  { key: 'openai', node: <OpenAI size={28} /> },
  { key: 'claude', node: <Claude.Color size={28} /> },
  { key: 'gemini', node: <Gemini.Color size={28} /> },
  { key: 'deepseek', node: <DeepSeek.Color size={28} /> },
  { key: 'qwen', node: <Qwen.Color size={28} /> },
  { key: 'grok', node: <Grok size={28} /> },
  { key: 'xai', node: <XAI size={28} /> },
  { key: 'zhipu', node: <Zhipu.Color size={28} /> },
  { key: 'volcengine', node: <Volcengine.Color size={28} /> },
  { key: 'cohere', node: <Cohere.Color size={28} /> },
  { key: 'moonshot', node: <Moonshot size={28} /> },
  { key: 'suno', node: <Suno size={28} /> },
  { key: 'minimax', node: <Minimax.Color size={28} /> },
  { key: 'wenxin', node: <Wenxin.Color size={28} /> },
  { key: 'spark', node: <Spark.Color size={28} /> },
  { key: 'qingyan', node: <Qingyan.Color size={28} /> },
  { key: 'midjourney', node: <Midjourney size={28} /> },
  { key: 'azureai', node: <AzureAI.Color size={28} /> },
  { key: 'hunyuan', node: <Hunyuan.Color size={28} /> },
  { key: 'xinference', node: <Xinference.Color size={28} /> },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full'>
          {/* ── Hero Section ── */}
          <section className='home-hero-section relative w-full border-b border-semi-color-border overflow-hidden'>
            {/* Dot grid background */}
            <div className='home-dot-grid absolute inset-0 pointer-events-none' />
            {/* Bottom fade to page background */}
            <div className='absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-semi-color-bg-0 to-transparent pointer-events-none' />

            <div className='relative z-10 flex flex-col items-center justify-center text-center px-4 py-20 md:py-28 lg:py-36 max-w-5xl mx-auto'>
              {/* Badge pill */}
              <div className='inline-flex items-center gap-2 rounded-full border border-semi-color-border bg-semi-color-bg-1/80 backdrop-blur-sm px-4 py-1.5 text-sm text-semi-color-text-1 mb-8 shadow-sm'>
                <span className='w-1.5 h-1.5 rounded-full bg-semi-color-primary animate-pulse' />
                <span>{t('支持 40+ 主流大模型供应商')}</span>
              </div>

              {/* Main headline */}
              <h1
                className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-semi-color-text-0 leading-[1.1] mb-5 ${isChinese ? 'tracking-tight' : ''}`}
              >
                {t('统一的')}
                <br />
                <span className='shine-text'>{t('大模型接口网关')}</span>
              </h1>

              {/* Sub headline */}
              <p className='text-base md:text-lg lg:text-xl text-semi-color-text-1 mb-10 max-w-xl'>
                {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
              </p>

              {/* URL bar */}
              <div className='w-full max-w-lg flex items-center gap-2 bg-semi-color-bg-1 border border-semi-color-border rounded-full px-3 py-2 mb-8 shadow-sm'>
                <code className='flex-1 font-mono text-sm text-semi-color-text-0 truncate pl-2'>
                  {serverAddress}
                </code>
                <div className='flex items-center gap-1.5 shrink-0'>
                  <ScrollList
                    bodyHeight={24}
                    style={{ border: 'none', boxShadow: 'none' }}
                  >
                    <ScrollItem
                      mode='wheel'
                      cycled={true}
                      list={endpointItems}
                      selectedIndex={endpointIndex}
                      onSelect={({ index }) => setEndpointIndex(index)}
                    />
                  </ScrollList>
                  <Button
                    type='primary'
                    icon={<IconCopy />}
                    className='!rounded-full !h-8 !w-8 !p-0 !min-w-0'
                    size='small'
                    onClick={handleCopyBaseURL}
                  />
                </div>
              </div>

              {/* CTA buttons */}
              <div className='flex flex-row gap-3 items-center mb-16'>
                <Link to='/console'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'default' : 'large'}
                    className='!rounded-full !px-7'
                    icon={<IconPlay />}
                  >
                    {t('获取密钥')}
                  </Button>
                </Link>
                {isDemoSiteMode && statusState?.status?.version ? (
                  <Button
                    size={isMobile ? 'default' : 'large'}
                    className='!rounded-full !px-5'
                    icon={<IconGithubLogo />}
                    onClick={() =>
                      window.open(
                        'https://github.com/QuantumNous/new-api',
                        '_blank',
                      )
                    }
                  >
                    {statusState.status.version}
                  </Button>
                ) : (
                  docsLink && (
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-full !px-5'
                      icon={<IconFile />}
                      onClick={() => window.open(docsLink, '_blank')}
                    >
                      {t('文档')}
                    </Button>
                  )
                )}
              </div>

              {/* Stats row */}
              <div className='flex items-center justify-center gap-6 sm:gap-10 md:gap-14 pt-8 border-t border-semi-color-border w-full'>
                <div className='text-center'>
                  <div className='text-2xl md:text-3xl font-bold tabular-nums text-semi-color-text-0'>
                    40+
                  </div>
                  <div className='text-xs md:text-sm text-semi-color-text-2 mt-1'>
                    {t('支持供应商')}
                  </div>
                </div>
                <div className='w-px h-8 bg-semi-color-border' />
                <div className='text-center'>
                  <div className='text-2xl md:text-3xl font-bold tabular-nums text-semi-color-text-0'>
                    {API_ENDPOINTS.length}
                  </div>
                  <div className='text-xs md:text-sm text-semi-color-text-2 mt-1'>
                    {t('API 端点')}
                  </div>
                </div>
                <div className='w-px h-8 bg-semi-color-border' />
                <div className='text-center'>
                  <div className='text-2xl md:text-3xl font-bold tabular-nums text-semi-color-text-0'>
                    99.9%
                  </div>
                  <div className='text-xs md:text-sm text-semi-color-text-2 mt-1'>
                    {t('服务可用率')}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Provider logos marquee ── */}
          <section className='py-10 md:py-12 border-b border-semi-color-border'>
            <p className='text-center text-xs md:text-sm text-semi-color-text-2 uppercase tracking-widest font-medium mb-7'>
              {t('支持众多的大模型供应商')}
            </p>
            <div className='home-marquee'>
              <div className='home-marquee-inner'>
                {PROVIDER_LOGOS.map(({ key, node }) => (
                  <div
                    key={key}
                    className='flex-shrink-0 w-11 h-11 flex items-center justify-center opacity-50 hover:opacity-90 transition-opacity duration-200'
                  >
                    {node}
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {PROVIDER_LOGOS.map(({ key, node }) => (
                  <div
                    key={`dup-${key}`}
                    className='flex-shrink-0 w-11 h-11 flex items-center justify-center opacity-50 hover:opacity-90 transition-opacity duration-200'
                  >
                    {node}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
