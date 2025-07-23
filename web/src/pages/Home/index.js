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
import { Button, Typography, Tag, Input, ScrollList, ScrollItem } from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile.js';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconGithubLogo, IconPlay, IconFile, IconCopy } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import { Moonshot, OpenAI, XAI, Zhipu, Volcengine, Cohere, Claude, Gemini, Suno, Minimax, Wenxin, Spark, Qingyan, DeepSeek, Qwen, Midjourney, Grok, AzureAI, Hunyuan, Xinference } from '@lobehub/icons';

const { Text } = Typography;

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress = statusState?.status?.server_address || window.location.origin;
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
          const theme = localStorage.getItem('theme-mode') || 'light';
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: theme }, '*');
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
    <div className="w-full overflow-x-hidden">
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className="w-full overflow-x-hidden">
          {/* Banner 部分 */}
          <div className="w-full border-b border-semi-color-border min-h-[500px] md:min-h-[600px] lg:min-h-[700px] relative overflow-x-hidden">
            {/* 背景模糊晕染球 */}
            <div className="blur-ball blur-ball-indigo" />
            <div className="blur-ball blur-ball-teal" />
            <div className="flex items-center justify-center h-full px-4 py-20 md:py-24 lg:py-32 mt-10">
              {/* 居中内容区 */}
              <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center mb-6 md:mb-8">
                  <h1 className={`text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-semi-color-text-0 leading-tight ${isChinese ? 'tracking-wide md:tracking-wider' : ''}`}>
                    {i18n.language === 'en' ? (
                      <>
                        The Unified<br />
                        <span className="shine-text">LLMs API Gateway</span>
                      </>
                    ) : (
                      <>
                        统一的<br />
                        <span className="shine-text">大模型接口网关</span>
                      </>
                    )}
                  </h1>
                  <p className="text-base md:text-lg lg:text-xl text-semi-color-text-1 mt-4 md:mt-6 max-w-xl">
                    {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
                  </p>
                  {/* BASE URL 与端点选择 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full mt-4 md:mt-6 max-w-md">
                    <Input
                      readonly
                      value={serverAddress}
                      className="flex-1 !rounded-full"
                      size={isMobile ? 'default' : 'large'}
                      suffix={
                        <div className="flex items-center gap-2">
                          <ScrollList bodyHeight={32} style={{ border: 'unset', boxShadow: 'unset' }}>
                            <ScrollItem
                              mode="wheel"
                              cycled={true}
                              list={endpointItems}
                              selectedIndex={endpointIndex}
                              onSelect={({ index }) => setEndpointIndex(index)}
                            />
                          </ScrollList>
                          <Button
                            type="primary"
                            onClick={handleCopyBaseURL}
                            icon={<IconCopy />}
                            className="!rounded-full"
                          />
                        </div>
                      }
                    />
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-row gap-4 justify-center items-center">
                  <Link to="/console">
                    <Button theme="solid" type="primary" size={isMobile ? "default" : "large"} className="!rounded-3xl px-8 py-2" icon={<IconPlay />}>
                      {t('获取密钥')}
                    </Button>
                  </Link>
                  {isDemoSiteMode && statusState?.status?.version ? (
                    <Button
                      size={isMobile ? "default" : "large"}
                      className="flex items-center !rounded-3xl px-6 py-2"
                      icon={<IconGithubLogo />}
                      onClick={() => window.open('https://github.com/QuantumNous/new-api', '_blank')}
                    >
                      {statusState.status.version}
                    </Button>
                  ) : (
                    docsLink && (
                      <Button
                        size={isMobile ? "default" : "large"}
                        className="flex items-center !rounded-3xl px-6 py-2"
                        icon={<IconFile />}
                        onClick={() => window.open(docsLink, '_blank')}
                      >
                        {t('文档')}
                      </Button>
                    )
                  )}
                </div>

                {/* 框架兼容性图标 */}
                <div className="mt-12 md:mt-16 lg:mt-20 w-full">
                  <div className="flex items-center mb-6 md:mb-8 justify-center">
                    <Text type="tertiary" className="text-lg md:text-xl lg:text-2xl font-light">
                      {t('支持众多的大模型供应商')}
                    </Text>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 max-w-5xl mx-auto px-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Moonshot size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <OpenAI size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <XAI size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Zhipu.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Volcengine.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Cohere.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Claude.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Gemini.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Suno size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Minimax.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Wenxin.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Spark.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Qingyan.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <DeepSeek.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Qwen.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Midjourney size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Grok size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <AzureAI.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Hunyuan.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Xinference.Color size={40} />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
                      <Typography.Text className="!text-lg sm:!text-xl md:!text-2xl lg:!text-3xl font-bold">30+</Typography.Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-hidden w-full">
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className="w-full h-screen border-none"
            />
          ) : (
            <div className="mt-[60px]" dangerouslySetInnerHTML={{ __html: homePageContent }} />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;

