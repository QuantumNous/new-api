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
import { Button } from '@douyinfe/semi-ui';
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

const providerIcons = [
  { key: 'moonshot', icon: <Moonshot size={26} /> },
  { key: 'openai', icon: <OpenAI size={26} /> },
  { key: 'xai', icon: <XAI size={26} /> },
  { key: 'zhipu', icon: <Zhipu.Color size={26} /> },
  { key: 'volcengine', icon: <Volcengine.Color size={26} /> },
  { key: 'cohere', icon: <Cohere.Color size={26} /> },
  { key: 'claude', icon: <Claude.Color size={26} /> },
  { key: 'gemini', icon: <Gemini.Color size={26} /> },
  { key: 'suno', icon: <Suno size={26} /> },
  { key: 'minimax', icon: <Minimax.Color size={26} /> },
  { key: 'wenxin', icon: <Wenxin.Color size={26} /> },
  { key: 'spark', icon: <Spark.Color size={26} /> },
  { key: 'qingyan', icon: <Qingyan.Color size={26} /> },
  { key: 'deepseek', icon: <DeepSeek.Color size={26} /> },
  { key: 'qwen', icon: <Qwen.Color size={26} /> },
  { key: 'midjourney', icon: <Midjourney size={26} /> },
  { key: 'grok', icon: <Grok size={26} /> },
  { key: 'azure', icon: <AzureAI.Color size={26} /> },
  { key: 'hunyuan', icon: <Hunyuan.Color size={26} /> },
  { key: 'xinference', icon: <Xinference.Color size={26} /> },
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

  const heroEyebrow = isChinese
    ? '更简单的模型接入体验'
    : 'A calmer way to connect AI models';
  const heroDescription = isChinese
    ? '更少的干扰，更清晰的入口。保留统一网关能力，只把体验收敛得更干净。'
    : 'A quieter interface with the same unified gateway power, designed to feel cleaner and easier to use.';
  const featureCards = isChinese
    ? [
        {
          title: '统一基址',
          description: '保持兼容入口，切换上游时不用重写客户端。',
        },
        {
          title: '稳定接入',
          description: '把供应商、模型和密钥管理收进同一层。',
        },
        {
          title: '更少噪音',
          description: '去掉多余装饰，让首页更像一个清晰的起点。',
        },
      ]
    : [
        {
          title: 'One base URL',
          description: 'Keep clients stable while switching upstream providers.',
        },
        {
          title: 'Controlled routing',
          description: 'Bring providers, models, and keys into one clean layer.',
        },
        {
          title: 'Less visual noise',
          description: 'Make the homepage feel like a clear starting point.',
        },
      ];

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
        <div className='home-apple-shell'>
          <div className='home-apple-orb home-apple-orb-primary' />
          <div className='home-apple-orb home-apple-orb-secondary' />
          <div className='home-apple-grid' />

          <div className='relative mx-auto flex min-h-[calc(100vh-60px)] max-w-6xl flex-col justify-center px-4 py-16 md:px-8 md:py-24'>
            <div className='home-apple-panel mx-auto w-full max-w-5xl'>
              <div className='flex flex-col items-center text-center'>
                <div className='home-apple-chip mb-6'>{heroEyebrow}</div>

                <h1
                  className={`max-w-4xl text-4xl font-semibold leading-[1.05] text-semi-color-text-0 md:text-6xl lg:text-7xl ${isChinese ? 'tracking-[-0.04em]' : 'tracking-[-0.06em]'}`}
                >
                  {t('统一的')}
                  <br />
                  <span className='home-apple-gradient-text'>
                    {t('大模型接口网关')}
                  </span>
                </h1>

                <p className='mt-6 max-w-2xl text-base leading-7 text-semi-color-text-1 md:text-lg'>
                  {heroDescription}
                </p>

                <div className='home-apple-url-bar mt-8 w-full max-w-3xl'>
                  <div className='min-w-0 flex-1 text-left'>
                    <div className='text-[11px] uppercase tracking-[0.24em] text-semi-color-text-3'>
                      Base URL
                    </div>
                    <div className='truncate pt-2 text-base font-medium text-semi-color-text-0 md:text-lg'>
                      {serverAddress}
                    </div>
                  </div>
                  <div className='home-apple-divider hidden md:block' />
                  <div className='hidden min-w-[220px] text-left md:block'>
                    <div className='text-[11px] uppercase tracking-[0.24em] text-semi-color-text-3'>
                      Endpoint
                    </div>
                    <div className='truncate pt-2 text-base text-semi-color-text-1'>
                      {endpointItems[endpointIndex].value}
                    </div>
                  </div>
                  <Button
                    theme='borderless'
                    icon={<IconCopy />}
                    onClick={handleCopyBaseURL}
                    className='home-apple-copy-btn'
                  />
                </div>

                <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
                  <Link to='/console'>
                    <Button
                      theme='solid'
                      type='primary'
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-full px-8'
                      icon={<IconPlay />}
                    >
                      {t('获取密钥')}
                    </Button>
                  </Link>
                  {isDemoSiteMode && statusState?.status?.version ? (
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-full px-6'
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
                        className='!rounded-full px-6'
                        icon={<IconFile />}
                        onClick={() => window.open(docsLink, '_blank')}
                      >
                        {t('文档')}
                      </Button>
                    )
                  )}
                </div>

                <div className='mt-10 grid w-full max-w-4xl gap-3 md:grid-cols-3'>
                  {featureCards.map((item) => (
                    <div key={item.title} className='home-apple-subcard'>
                      <div className='text-sm font-semibold text-semi-color-text-0'>
                        {item.title}
                      </div>
                      <p className='mt-2 text-sm leading-6 text-semi-color-text-2'>
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className='mx-auto mt-8 w-full max-w-5xl'>
              <div className='mb-4 text-center text-sm font-medium tracking-[0.2em] text-semi-color-text-3 uppercase'>
                {t('支持众多的大模型供应商')}
              </div>
              <div className='home-apple-provider-panel'>
                {providerIcons.map((provider) => (
                  <div key={provider.key} className='home-apple-provider-item'>
                    {provider.icon}
                  </div>
                ))}
                <div className='home-apple-provider-count'>30+</div>
              </div>
            </div>
          </div>
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
