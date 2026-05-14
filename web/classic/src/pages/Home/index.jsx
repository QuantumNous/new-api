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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import NoticeModal from '../../components/layout/NoticeModal';
import LandingAnnouncement from './components/LandingAnnouncement';
import LandingHero from './components/LandingHero';
import FeaturedModels from './components/FeaturedModels';
import ModelFamilies from './components/ModelFamilies';
import ApiScenarios from './components/ApiScenarios';
import WhyChooseSection from './components/WhyChooseSection';
import IntegrationSteps from './components/IntegrationSteps';
import LandingFAQ from './components/LandingFAQ';
import LandingBottomCTA from './components/LandingBottomCTA';
import { announcement } from './landingData';

const MAX_PRICING_PREVIEW_CARDS = 6;
const MIN_PRICING_PREVIEW_CARDS = 3;
const MAX_PRICING_DESCRIPTION_LENGTH = 96;

const truncateText = (text, maxLength) => {
  if (typeof text !== 'string') return '';
  const value = text.trim();
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
};

const normalizeTag = (tag) => {
  if (tag === undefined || tag === null) return '';
  return String(tag).replace(/[_-]+/g, ' ').trim();
};

const normalizeTags = (model) => {
  const tagItems =
    typeof model.tags === 'string'
      ? model.tags.split(/[,;|，、]+/)
      : Array.isArray(model.tags)
        ? model.tags
        : [];
  const endpointItems = Array.isArray(model.supported_endpoint_types)
    ? model.supported_endpoint_types
    : [];

  const tags = [...tagItems, ...endpointItems]
    .map(normalizeTag)
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(tags)).slice(0, 3);

  return uniqueTags.length > 0
    ? uniqueTags
    : ['OpenAI 兼容', 'API', '站点配置'];
};

const buildVendorMap = (vendors) => {
  if (!Array.isArray(vendors)) return {};

  return vendors.reduce((map, vendor) => {
    if (vendor && vendor.id !== undefined && vendor.name) {
      map[String(vendor.id)] = vendor.name;
    }
    return map;
  }, {});
};

const normalizePricingPreviewCards = (payload) => {
  if (!payload?.success || !Array.isArray(payload.data)) return [];

  const vendorMap = buildVendorMap(payload.vendors);
  const cards = payload.data
    .filter(
      (model) =>
        model &&
        typeof model.model_name === 'string' &&
        model.model_name.trim() !== '',
    )
    .slice(0, MAX_PRICING_PREVIEW_CARDS)
    .map((model) => ({
      title: model.model_name.trim(),
      provider: vendorMap[String(model.vendor_id)] || '站点配置',
      description:
        truncateText(model.description, MAX_PRICING_DESCRIPTION_LENGTH) ||
        '该模型来自站点公开配置，具体可用范围、权限与计费方式以控制台和价格页为准。',
      tags: normalizeTags(model),
      status: '按站点配置计费',
    }));

  return cards.length >= MIN_PRICING_PREVIEW_CARDS ? cards : [];
};

const normalizeFaqItems = (items) => {
  if (!Array.isArray(items)) return undefined;

  const faqItems = items
    .map((item) => ({
      question: typeof item?.question === 'string' ? item.question.trim() : '',
      answer: typeof item?.answer === 'string' ? item.answer.trim() : '',
    }))
    .filter((item) => item.question && item.answer);

  return faqItems.length > 0 ? faqItems : undefined;
};

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [pricingPreviewCards, setPricingPreviewCards] = useState([]);
  const isMobile = useIsMobile();
  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const currentEndpoint =
    endpointItems[endpointIndex]?.value || API_ENDPOINTS[0];
  const faqItems = useMemo(
    () => normalizeFaqItems(statusState?.status?.faq),
    [statusState?.status?.faq],
  );

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
    if (!homePageContentLoaded || homePageContent !== '') return;

    let ignore = false;

    const loadPricingPreview = async () => {
      try {
        const res = await API.get('/api/pricing', {
          skipErrorHandler: true,
        });
        const previewCards = normalizePricingPreviewCards(res.data);
        if (!ignore && previewCards.length > 0) {
          setPricingPreviewCards(previewCards);
        }
      } catch {
        // Keep the static landing cards when public pricing is unavailable.
      }
    };

    loadPricingPreview();

    return () => {
      ignore = true;
    };
  }, [homePageContent, homePageContentLoaded]);

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
        <div className='landing-home-shell h-screen w-full overflow-y-auto overflow-x-hidden bg-semi-color-bg-0 pt-16 text-semi-color-text-0'>
          <section className='landing-first-screen'>
            <LandingAnnouncement
              announcement={announcement}
              docsLink={docsLink}
            />
            <LandingHero
              docsLink={docsLink}
              endpoint={currentEndpoint}
              isSelfUseMode={isSelfUseMode}
              onCopyBaseURL={handleCopyBaseURL}
              serverAddress={serverAddress}
              user={userState.user}
            />
          </section>
          <FeaturedModels items={pricingPreviewCards} />
          <ModelFamilies />
          <ApiScenarios />
          <WhyChooseSection />
          <IntegrationSteps
            docsLink={docsLink}
            isSelfUseMode={isSelfUseMode}
            user={userState.user}
          />
          <LandingFAQ items={faqItems} />
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
