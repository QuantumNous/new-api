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

const UserAgreement = () => {
  const { t } = useTranslation();
  const [userAgreement, setUserAgreement] = useState('');
  const [userAgreementLoaded, setUserAgreementLoaded] = useState(false);
  const [contentType, setContentType] = useState('empty');
  const [htmlBody, setHtmlBody] = useState('');
  const [htmlStyles, setHtmlStyles] = useState('');
  const [htmlLinks, setHtmlLinks] = useState([]);
  // Height of the top navigation/header in pixels. Adjust if your header is a different height.
  const HEADER_HEIGHT = 64;

  const displayUserAgreement = async () => {
    // 先从缓存中获取
    const cachedContent = localStorage.getItem('user_agreement') || '';
    if (cachedContent) {
      setUserAgreement(cachedContent);
      const ct = getContentType(cachedContent);
      setContentType(ct);
      if (ct === 'html') {
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
      const res = await API.get('/api/user-agreement');
      const { success, message, data } = res.data;
      if (success && data) {
        // 直接使用原始数据，不进行任何预处理
        setUserAgreement(data);
        const ct = getContentType(data);
        setContentType(ct);
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
        localStorage.setItem('user_agreement', data);
      } else {
        if (!cachedContent) {
          showError(message || t('加载用户协议内容失败...'));
          setUserAgreement('');
          setContentType('empty');
        }
      }
    } catch (error) {
      if (!cachedContent) {
        showError(t('加载用户协议内容失败...'));
        setUserAgreement('');
        setContentType('empty');
      }
    }
    setUserAgreementLoaded(true);
  };

  useEffect(() => {
    displayUserAgreement();
  }, []);

  // inject inline styles for parsed HTML content and cleanup on unmount or styles change
  useEffect(() => {
    // if there's nothing to inject, remove any existing injected elements
    const styleId = 'user-agreement-inline-styles';
    const createdLinkIds = [];

    // handle style tags
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

    // handle external stylesheet links
    if (htmlLinks && htmlLinks.length) {
      htmlLinks.forEach((href, idx) => {
        try {
          // avoid duplicate injection if a link with same href already exists
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
          // ignore malformed hrefs
        }
      });
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
      // remove only the links we created
      createdLinkIds.forEach((id) => {
        const l = document.getElementById(id);
        if (l) l.remove();
      });
    };
  }, [htmlStyles]);

  const renderContent = () => {
    if (!userAgreementLoaded) {
      return (
        <div style={{ padding: '16px', paddingTop: `${HEADER_HEIGHT + 16}px` }}>
          <MarkdownRenderer content="" loading={true} />
        </div>
      );
    }

    if (contentType === 'empty' || !userAgreement) {
      return (
        <div style={{ marginTop: HEADER_HEIGHT + 20 }}>
          <Empty
            image={
              <IllustrationConstruction style={{ width: 150, height: 150 }} />
            }
            darkModeImage={
              <IllustrationConstructionDark style={{ width: 150, height: 150 }} />
            }
            description={t('管理员未设置用户协议内容')}
          />
        </div>
      );
    }

    if (contentType === 'url') {
      return (
        <iframe
          src={userAgreement}
          style={{
            width: '100%',
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            border: 'none',
            marginTop: `${HEADER_HEIGHT}px`,
          }}
          title={t('用户协议')}
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
          dangerouslySetInnerHTML={{ __html: htmlBody || userAgreement }}
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
          content={userAgreement}
          fontSize={16}
          style={{ lineHeight: '1.8' }}
        />
      </div>
    );
  };

  return <>{renderContent()}</>;
};

export default UserAgreement;