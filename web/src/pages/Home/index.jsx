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

          {/* ═══════ HERO SECTION ═══════ */}
          <section className='relative min-h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden'>
            {/* ── Background layers ── */}
            <div className='absolute inset-0 hero-gradient-flow pointer-events-none' />
            {/* Circuit network SVG background */}
            <div className='absolute inset-0 pointer-events-none hero-circuit-bg' style={{
              backgroundImage: 'url(/hero-bg.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }} />
            <div className='absolute inset-0 opacity-[0.02] pointer-events-none' style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }} />
            {/* Top glow line */}
            <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,80vw)] h-px pointer-events-none' style={{
              background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(6,182,212,0.4), transparent)'
            }} />
            {/* Radial spotlight */}
            <div className='absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none' style={{
              background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)'
            }} />

            {/* ── Content ── */}
            <div className='relative z-10 flex flex-col items-center text-center px-6 py-20 md:py-28 max-w-4xl mx-auto'>

              {/* Badge */}
              <div className='mb-8 md:mb-10 animate-fade-in-up'>
                <span className='inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs md:text-sm font-medium tracking-wide border backdrop-blur-sm' style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  borderColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'rgb(129, 140, 248)'
                }}>
                  <span className='relative flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-green-400' />
                  </span>
                  {t('无需翻墙即可使用海外大模型')}
                </span>
              </div>

              {/* Title */}
              <h1 className='animate-fade-in-up' style={{ animationDelay: '0.1s' }}>
                <span className='block text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-extrabold tracking-tight text-semi-color-text-0'>
                  OpenAPI
                </span>
                <span className='block mt-4 md:mt-5 text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight' style={{
                  background: 'linear-gradient(135deg, #818cf8 0%, #06b6d4 40%, #a78bfa 70%, #c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {t('大模型接口网关')}
                </span>
              </h1>

              {/* Subtitle */}
              <p className='mt-6 md:mt-8 text-base md:text-lg lg:text-xl text-semi-color-text-2 max-w-xl leading-relaxed font-light animate-fade-in-up' style={{ animationDelay: '0.2s' }}>
                {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
              </p>

              {/* URL Bar */}
              <div className='w-full max-w-lg mt-8 md:mt-10 animate-fade-in-up' style={{ animationDelay: '0.3s' }}>
                <div className='relative group' style={{
                  background: 'var(--glass-bg-thin)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: '9999px',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 0 0 1px rgba(99,102,241,0.04), 0 4px 30px rgba(99,102,241,0.06)',
                  transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
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

              {/* CTA */}
              <div className='flex flex-col sm:flex-row gap-4 justify-center items-center mt-10 md:mt-12 animate-fade-in-up' style={{ animationDelay: '0.4s' }}>
                <button
                  onClick={() => navigate('/console/token')}
                  className='group relative inline-flex items-center gap-2.5 px-8 py-3 rounded-full text-white text-base font-semibold overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]'
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.08)',
                  }}
                >
                  {/* Shine effect on hover */}
                  <span className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />
                  <IconPlay className='relative z-10' />
                  <span className='relative z-10'>{t('获取密钥')}</span>
                </button>

                {isDemoSiteMode && statusState?.status?.version && (
                  <button
                    onClick={() => window.open('https://github.com/QuantumNous/new-api', '_blank')}
                    className='inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]'
                    style={{
                      background: 'var(--glass-bg-thin)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--semi-color-text-1)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <IconGithubLogo />
                    {statusState.status.version}
                  </button>
                )}
              </div>

              {/* Stats row */}
              <div className='flex flex-wrap justify-center gap-8 md:gap-16 mt-16 md:mt-20 animate-fade-in-up' style={{ animationDelay: '0.5s' }}>
                {[
                  { value: '40+', label: t('支持模型供应商') },
                  { value: '99.9%', label: t('服务可用性') },
                  { value: '<100ms', label: t('平均响应延迟') },
                ].map((stat) => (
                  <div key={stat.label} className='text-center'>
                    <div className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>{stat.value}</div>
                    <div className='text-xs md:text-sm text-semi-color-text-2 mt-1 font-light'>{stat.label}</div>
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom fade */}
            <div className='absolute bottom-0 left-0 right-0 h-32 pointer-events-none' style={{
              background: 'linear-gradient(to top, var(--semi-color-bg-0), transparent)'
            }} />
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
