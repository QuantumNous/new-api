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
  IconGithubLogo,
  IconPlay,
  IconCopy,
} from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';

const { Text } = Typography;

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
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
        <div className='w-full overflow-x-hidden'>
          {/* Banner 部分 — 高级科技感设计 */}
          <div className='w-full min-h-[600px] md:min-h-[700px] lg:min-h-[800px] relative overflow-hidden'>
            {/* 背景：流动渐变动画 */}
            <div className='absolute inset-0 hero-gradient-flow pointer-events-none' />
            {/* 微妙的网格纹理 */}
            <div className='absolute inset-0 opacity-[0.03] pointer-events-none' style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px'
            }} />
            {/* 顶部光线 */}
            <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] pointer-events-none' style={{
              background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), rgba(6, 182, 212, 0.5), transparent)'
            }} />

            <div className='flex items-center justify-center h-full px-4 py-16 md:py-20 lg:py-24 mt-10'>
              <div className='flex flex-col items-center justify-center text-center max-w-4xl mx-auto'>

                {/* 顶部标签 */}
                <div className='mb-6 md:mb-8'>
                  <span className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs md:text-sm font-medium border' style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    color: 'rgb(129, 140, 248)'
                  }}>
                    <span className='w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse' />
                    {t('无需翻墙即可使用海外大模型')}
                  </span>
                </div>

                {/* 主标题 */}
                <h1 className='text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[1.05] tracking-tight mb-6'>
                  <span className='text-semi-color-text-0'>OpenAPI</span>
                  <br />
                  <span style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 50%, #a855f7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>{t('大模型接口网关')}</span>
                </h1>

                {/* 副标题 */}
                <p className='text-base md:text-lg lg:text-xl text-semi-color-text-2 mt-2 mb-8 md:mb-10 max-w-2xl leading-relaxed font-light'>
                  {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
                </p>

                {/* BASE URL 输入框 — 毛玻璃风格 */}
                <div className='w-full max-w-lg mb-8 md:mb-10'>
                  <div className='relative' style={{
                    background: 'var(--glass-bg-thin)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: '9999px',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 0 40px rgba(99, 102, 241, 0.06)',
                  }}>
                    <Input
                      readonly
                      value={serverAddress}
                      className='flex-1 !rounded-full !bg-transparent !border-none'
                      size={isMobile ? 'default' : 'large'}
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
                            className='!rounded-full'
                          />
                        </div>
                      }
                    />
                  </div>
                </div>

                {/* CTA 按钮 */}
                <div className='flex flex-row gap-4 justify-center items-center mb-16 md:mb-20'>
                    <Button
                      theme='solid'
                      type='primary'
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-full !px-8 !py-2.5 !text-base !font-medium'
                      icon={<IconPlay />}
                      onClick={() => navigate('/console/token')}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3), 0 0 40px rgba(99, 102, 241, 0.1)',
                        border: 'none',
                      }}
                    >
                      {t('获取密钥')}
                    </Button>
                  {isDemoSiteMode && statusState?.status?.version && (
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='flex items-center !rounded-full !px-6 !py-2.5'
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
                  )}
                </div>

                {/* 供应商图标区已移除 */}
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
