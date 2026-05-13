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
  API,
  showError,
  copy,
  showSuccess,
  getLogo,
  getSystemName,
} from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import NoticeModal from '../../components/layout/NoticeModal';
import LandingAnnouncement from './components/LandingAnnouncement';
import LandingNav from './components/LandingNav';
import LandingHero from './components/LandingHero';
import FeaturedModels from './components/FeaturedModels';
import ModelFamilies from './components/ModelFamilies';
import ApiScenarios from './components/ApiScenarios';
import WhyChooseSection from './components/WhyChooseSection';
import IntegrationSteps from './components/IntegrationSteps';
import LandingFAQ from './components/LandingFAQ';
import LandingBottomCTA from './components/LandingBottomCTA';
import { announcement } from './landingData';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const logo = statusState?.status?.logo || getLogo();
  const systemName =
    statusState?.status?.system_name || getSystemName() || 'New API';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const currentEndpoint =
    endpointItems[endpointIndex]?.value || API_ENDPOINTS[0];

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
        <div className='h-screen w-full overflow-y-auto overflow-x-hidden bg-semi-color-bg-0 pt-16 text-semi-color-text-0'>
          <LandingAnnouncement
            announcement={announcement}
            docsLink={docsLink}
          />
          <LandingNav
            docsLink={docsLink}
            isSelfUseMode={isSelfUseMode}
            logo={logo}
            systemName={systemName}
            user={userState.user}
          />
          <LandingHero
            docsLink={docsLink}
            endpoint={currentEndpoint}
            isSelfUseMode={isSelfUseMode}
            onCopyBaseURL={handleCopyBaseURL}
            serverAddress={serverAddress}
            user={userState.user}
          />
          <FeaturedModels />
          <ModelFamilies />
          <ApiScenarios />
          <WhyChooseSection />
          <IntegrationSteps
            docsLink={docsLink}
            isSelfUseMode={isSelfUseMode}
            user={userState.user}
          />
          <LandingFAQ />
          <LandingBottomCTA
            docsLink={docsLink}
            isSelfUseMode={isSelfUseMode}
            user={userState.user}
          />
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
