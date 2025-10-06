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
import { Empty } from '@douyinfe/semi-ui';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { getContentType } from '../../utils/contentDetector';

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [privacyPolicyLoaded, setPrivacyPolicyLoaded] = useState(false);
  const [contentType, setContentType] = useState('empty');
  const [htmlBody, setHtmlBody] = useState('');
  const [htmlStyles, setHtmlStyles] = useState('');
  const [htmlLinks, setHtmlLinks] = useState([]);
  // Height of the top navigation/header in pixels. Adjust if your header is a different height.
  const HEADER_HEIGHT = 64;

  const displayPrivacyPolicy = async () => {
    // 先从缓存中获取
    const cachedContent = localStorage.getItem('privacy_policy') || '';
    if (cachedContent) {
      setPrivacyPolicy(cachedContent);
      const ct = getContentType(cachedContent);
      setContentType(ct);
      if (ct === 'html') {
        // parse cached HTML to extract body and inline styles
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(cachedContent, 'text/html');
          setHtmlBody(doc.body ? doc.body.innerHTML : cachedContent);
          const styles = Array.from(doc.querySelectorAll('style'))
            .map((s) => s.innerHTML)
            .join('\n');
          setHtmlStyles(styles);
            const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
              .map((l) => l.getAttribute('href') || l.href)
              .filter(Boolean);
            setHtmlLinks(links);
        } catch (e) {
          setHtmlBody(cachedContent);
          setHtmlStyles('');
            setHtmlLinks([]);
        }
      }
    }

    try {
      const res = await API.get('/api/privacy-policy');
      const { success, message, data } = res.data;
      if (success && data) {
        // 直接使用原始数据，不进行任何预处理
        setPrivacyPolicy(data);
        const ct = getContentType(data);
        setContentType(ct);
        // 如果是完整 HTML 文档，解析 body 内容并提取内联样式放到 head
        if (ct === 'html') {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');
            setHtmlBody(doc.body ? doc.body.innerHTML : data);
            const styles = Array.from(doc.querySelectorAll('style'))
              .map((s) => s.innerHTML)
              .join('\n');
            setHtmlStyles(styles);
              const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
                .map((l) => l.getAttribute('href') || l.href)
                .filter(Boolean);
              setHtmlLinks(links);
          } catch (e) {
            setHtmlBody(data);
            setHtmlStyles('');
              setHtmlLinks([]);
          }
        } else {
          setHtmlBody('');
          setHtmlStyles('');
            setHtmlLinks([]);
        }
        localStorage.setItem('privacy_policy', data);
      } else {
        if (!cachedContent) {
          showError(message || t('加载隐私政策内容失败...'));
          setPrivacyPolicy('');
          setContentType('empty');
        }
      }
    } catch (error) {
      if (!cachedContent) {
        showError(t('加载隐私政策内容失败...'));
        setPrivacyPolicy('');
        setContentType('empty');
      }
    }
    setPrivacyPolicyLoaded(true);
  };

  useEffect(() => {
    displayPrivacyPolicy();
  }, []);

  // inject inline styles for parsed HTML content and cleanup on unmount or styles change
  useEffect(() => {
    const styleId = 'privacy-policy-inline-styles';
    const createdLinkIds = [];

    if (htmlStyles) {
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.type = 'text/css';
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = htmlStyles;
    } else {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    }

    if (htmlLinks && htmlLinks.length) {
      htmlLinks.forEach((href, idx) => {
        try {
          const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
          if (existing) return;
          const linkId = `${styleId}-link-${idx}`;
          const linkEl = document.createElement('link');
          linkEl.id = linkId;
          linkEl.rel = 'stylesheet';
          linkEl.href = href;
          document.head.appendChild(linkEl);
          createdLinkIds.push(linkId);
        } catch (e) {
          // ignore
        }
      });
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
      createdLinkIds.forEach((id) => {
        const l = document.getElementById(id);
        if (l) l.remove();
      });
    };
  }, [htmlStyles]);

  const renderContent = () => {
    if (!privacyPolicyLoaded) {
      return (
        <div style={{ padding: '16px', paddingTop: `${HEADER_HEIGHT + 16}px` }}>
          <MarkdownRenderer content="" loading={true} />
        </div>
      );
    }

    if (contentType === 'empty' || !privacyPolicy) {
      return (
        <div style={{ marginTop: HEADER_HEIGHT + 20 }}>
          <Empty
            image={
              <IllustrationConstruction style={{ width: 150, height: 150 }} />
            }
            darkModeImage={
              <IllustrationConstructionDark style={{ width: 150, height: 150 }} />
            }
            description={t('管理员未设置隐私政策内容')}
          />
        </div>
      );
    }

    if (contentType === 'url') {
      return (
        <iframe
          src={privacyPolicy}
          style={{
            width: '100%',
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            border: 'none',
            marginTop: `${HEADER_HEIGHT}px`,
          }}
          title={t('隐私政策')}
        />
      );
    }

    if (contentType === 'html') {
      return (
        <div
          style={{
            padding: '24px',
            paddingTop: `${HEADER_HEIGHT + 24}px`,
            maxWidth: '1000px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}
          dangerouslySetInnerHTML={{ __html: htmlBody || privacyPolicy }}
        />
      );
    }

    // markdown 或 text 内容
    return (
      <div
        style={{
          padding: '24px',
          paddingTop: `${HEADER_HEIGHT + 24}px`,
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <MarkdownRenderer
          content={privacyPolicy}
          fontSize={16}
          style={{ lineHeight: '1.8' }}
        />
      </div>
    );
  };

  return <>{renderContent()}</>;
};

export default PrivacyPolicy;