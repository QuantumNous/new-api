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
  Input,
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
  IconCopy,
  IconKey,
  IconArrowRight,
} from '@douyinfe/semi-icons';
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

const AGENTRIX_BASE_URL = 'https://api.xmz.ai';
const AGENTRIX_KEYS_URL = 'https://admin.xmz.ai/api-keys';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
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

      // 如果内容是 URL，则发送主题模式
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
    const ok = await copy(AGENTRIX_BASE_URL);
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
        <div className='w-full overflow-x-hidden'>
          {/* Hero Section */}
          <div className='w-full relative overflow-x-hidden min-h-[580px] md:min-h-[680px] flex flex-col'>
            {/* Background gradient orbs */}
            <div className='pointer-events-none absolute inset-0 overflow-hidden'>
              <div className='absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl'
                style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
              <div className='absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl'
                style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
              <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-3xl'
                style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 60%)' }} />
            </div>

            <div className='flex-1 flex items-center justify-center px-6 py-24 md:py-32 mt-8 relative z-10'>
              <div className='flex flex-col items-center justify-center text-center max-w-4xl mx-auto w-full'>

                {/* Badge */}
                <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-semi-color-border bg-semi-color-bg-1 text-semi-color-text-2 text-xs font-medium mb-8 shadow-sm'>
                  <span className='w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse' />
                  {isChinese ? '稳定运行中' : 'Operational'}
                </div>

                {/* Main heading */}
                <h1 className='text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-semi-color-text-0 leading-none tracking-tight mb-2'>
                  <span style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #3b82f6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    Agentrix
                  </span>
                  <span className='text-semi-color-text-0'> API</span>
                </h1>

                {/* Tagline */}
                <p className='text-lg md:text-xl lg:text-2xl text-semi-color-text-1 mt-5 mb-10 max-w-2xl font-light leading-relaxed'>
                  {isChinese ? '统一的 AI 接口，连接 40+ 顶级模型供应商' : 'One unified AI gateway connecting 40+ top model providers'}
                </p>

                {/* BASE URL input */}
                <div className='w-full max-w-lg mb-8'>
                  <p className='text-xs text-semi-color-text-2 mb-2 text-left px-1'>
                    {isChinese ? '只需将模型基址替换为：' : 'Just replace your base URL with:'}
                  </p>
                  <Input
                    readonly
                    value={AGENTRIX_BASE_URL}
                    className='!rounded-xl'
                    size='large'
                    suffix={
                      <div className='flex items-center gap-2'>
                        <ScrollList
                          bodyHeight={32}
                          style={{ border: 'unset', boxShadow: 'unset' }}
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
                          onClick={handleCopyBaseURL}
                          icon={<IconCopy />}
                          className='!rounded-lg'
                        />
                      </div>
                    }
                  />
                </div>

                {/* CTA Button */}
                <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
                  <a href={AGENTRIX_KEYS_URL} target='_blank' rel='noopener noreferrer'>
                    <Button
                      theme='solid'
                      type='primary'
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-xl !px-8'
                      icon={<IconKey />}
                      iconPosition='left'
                    >
                      {isChinese ? '获取密钥' : 'Get API Key'}
                    </Button>
                  </a>
                  <a href='/pricing'>
                    <Button
                      theme='borderless'
                      type='tertiary'
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-xl !px-8'
                      icon={<IconArrowRight />}
                      iconPosition='right'
                    >
                      {isChinese ? '浏览模型广场' : 'Browse Models'}
                    </Button>
                  </a>
                </div>

                {/* Provider icons */}
                <div className='mt-16 md:mt-20 w-full border-t border-semi-color-border pt-12'>
                  <p className='text-xs text-semi-color-text-2 uppercase tracking-widest mb-8 font-medium'>
                    {isChinese ? '接入全球顶级 AI 供应商' : 'Connected to top AI providers worldwide'}
                  </p>
                  <div className='flex flex-wrap items-center justify-center gap-4 sm:gap-5 md:gap-7 max-w-4xl mx-auto px-4'>
                    {[
                      <OpenAI size={36} />, <Claude.Color size={36} />, <Gemini.Color size={36} />,
                      <DeepSeek.Color size={36} />, <Qwen.Color size={36} />, <Grok size={36} />,
                      <Moonshot size={36} />, <XAI size={36} />, <Zhipu.Color size={36} />,
                      <Volcengine.Color size={36} />, <Cohere.Color size={36} />, <Suno size={36} />,
                      <Minimax.Color size={36} />, <Wenxin.Color size={36} />, <Spark.Color size={36} />,
                      <Qingyan.Color size={36} />, <Midjourney size={36} />, <AzureAI.Color size={36} />,
                      <Hunyuan.Color size={36} />, <Xinference.Color size={36} />,
                    ].map((icon, i) => (
                      <div key={i} className='w-9 h-9 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity'>
                        {icon}
                      </div>
                    ))}
                    <div className='w-9 h-9 flex items-center justify-center'>
                      <Typography.Text className='!text-xl font-bold text-semi-color-text-2'>
                        40+
                      </Typography.Text>
                    </div>
                  </div>
                </div>

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
