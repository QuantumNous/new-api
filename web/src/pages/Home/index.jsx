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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import NoticeModal from '../../components/layout/NoticeModal';
import DefaultHomePage from './DefaultHomePage';
import { shouldRenderDefaultHomePage } from './homeSections';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [rawHomePageContent, setRawHomePageContent] = useState('');
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const iframeRef = useRef(null);
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);

  const renderCustomHomePageContent = (content) => {
    if (!content || content.startsWith('https://')) {
      return content;
    }

    if (typeof document === 'undefined') {
      return content;
    }

    const container = document.createElement('div');
    container.innerHTML = content;

    const translateValue = (value) => {
      if (!value) {
        return value;
      }
      const leading = value.match(/^\s*/)?.[0] || '';
      const trailing = value.match(/\s*$/)?.[0] || '';
      const core = value.trim();
      if (!core) {
        return value;
      }
      return `${leading}${t(core)}${trailing}`;
    };

    const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

    const textWalker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
    );
    let currentTextNode = textWalker.nextNode();
    while (currentTextNode) {
      const parentTag = currentTextNode.parentElement?.tagName;
      if (!skippedTags.has(parentTag)) {
        currentTextNode.textContent = translateValue(currentTextNode.textContent);
      }
      currentTextNode = textWalker.nextNode();
    }

    container
      .querySelectorAll('[placeholder], [title], [aria-label]')
      .forEach((node) => {
        ['placeholder', 'title', 'aria-label'].forEach((attrName) => {
          const attrValue = node.getAttribute(attrName);
          if (!attrValue) {
            return;
          }
          node.setAttribute(attrName, translateValue(attrValue));
        });
      });

    container.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      node.textContent = t(key);
    });

    container.querySelectorAll('[data-i18n-html]').forEach((node) => {
      const key = node.getAttribute('data-i18n-html');
      if (!key) {
        return;
      }
      node.innerHTML = t(key);
    });

    container.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      if (!key) {
        return;
      }
      node.setAttribute('placeholder', t(key));
    });

    container.querySelectorAll('[data-i18n-title]').forEach((node) => {
      const key = node.getAttribute('data-i18n-title');
      if (!key) {
        return;
      }
      node.setAttribute('title', t(key));
    });

    container.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
      const key = node.getAttribute('data-i18n-aria-label');
      if (!key) {
        return;
      }
      node.setAttribute('aria-label', t(key));
    });

    return container.innerHTML;
  };

  const syncIframeThemeAndLanguage = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      return;
    }
    iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
    iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
  };

  const displayHomePageContent = async () => {
    const cachedContent = localStorage.getItem('home_page_content') || '';
    setRawHomePageContent(cachedContent);
    setHomePageContent(renderCustomHomePageContent(cachedContent));
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setRawHomePageContent(content);
      setHomePageContent(renderCustomHomePageContent(content));
      localStorage.setItem('home_page_content', content);
    } else {
      showError(message);
      setRawHomePageContent('加载首页内容失败...');
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
    setHomePageContent(renderCustomHomePageContent(rawHomePageContent));
  }, [rawHomePageContent, i18n.language]);

  useEffect(() => {
    if (!homePageContent.startsWith('https://')) {
      return;
    }
    syncIframeThemeAndLanguage();
  }, [homePageContent, actualTheme, i18n.language]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);


  const renderDefaultHomePage = shouldRenderDefaultHomePage({
    homePageContentLoaded,
    homePageContent,
  });

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {renderDefaultHomePage ? (
        <DefaultHomePage
          t={t}
          isMobile={isMobile}
          serverAddress={serverAddress}
          endpointItems={endpointItems}
          endpointIndex={endpointIndex}
          onEndpointChange={setEndpointIndex}
          onCopyBaseURL={handleCopyBaseURL}
          docsLink={docsLink}
          isDemoSiteMode={isDemoSiteMode}
        />
      ) : (
        <div className='w-full overflow-x-hidden'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              ref={iframeRef}
              src={homePageContent}
              className='h-screen w-full border-none'
              onLoad={syncIframeThemeAndLanguage}
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
