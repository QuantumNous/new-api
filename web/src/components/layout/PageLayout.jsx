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

import HeaderBar from './headerbar';
import SiderBar from './SiderBar';
import App from '../../App';
import FooterBar from './Footer';
import ToastViewport from '../ui/ToastViewport';
import ErrorBoundary from '../common/ErrorBoundary';
import React, { useContext, useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useTranslation } from 'react-i18next';
import {
  API,
  getLogo,
  getSystemName,
  showError,
  setStatusData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLocation } from 'react-router-dom';
import { normalizeLanguage } from '../../i18n/language';

const getFallbackStatus = () => {
  try {
    const cachedStatus = localStorage.getItem('status');
    if (cachedStatus) {
      return JSON.parse(cachedStatus);
    }
  } catch (error) {
    console.warn('Failed to parse cached status', error);
  }

  return {
    system_name: getSystemName(),
    logo: getLogo(),
    footer_html: localStorage.getItem('footer_html') || '',
    HeaderNavModules: '',
    announcements: [],
    docs_link: localStorage.getItem('docs_link') || '',
    self_use_mode_enabled: false,
    demo_site_enabled: false,
    api_info_enabled: true,
    announcements_enabled: true,
    faq_enabled: true,
    uptime_kuma_enabled: true,
  };
};

const PageLayout = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, , setCollapsed] = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { i18n } = useTranslation();
  const location = useLocation();

  const cardProPages = [
    '/console/channel',
    '/console/log',
    '/console/redemption',
    '/console/user',
    '/console/token',
    '/console/midjourney',
    '/console/task',
    '/console/models',
    '/pricing',
  ];

  const isConsoleRoute = location.pathname.startsWith('/console');
  const shouldHideFooter =
    isConsoleRoute || cardProPages.includes(location.pathname);

  const shouldInnerPadding =
    location.pathname.includes('/console') &&
    !location.pathname.startsWith('/console/chat') &&
    location.pathname !== '/console/playground';

  const showSider = isConsoleRoute && (!isMobile || drawerOpen);

  useEffect(() => {
    if (isMobile && drawerOpen && collapsed) {
      setCollapsed(false);
    }
  }, [isMobile, drawerOpen, collapsed, setCollapsed]);

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      let data = JSON.parse(user);
      userDispatch({ type: 'login', payload: data });
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status', { skipErrorHandler: true });
      const { success, data } = res.data;
      if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
      } else {
        statusDispatch({ type: 'set', payload: getFallbackStatus() });
        showError('Unable to connect to server');
      }
    } catch (error) {
      console.error('Failed to load status', error);
      statusDispatch({ type: 'set', payload: getFallbackStatus() });
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().catch(console.error);
    let systemName = getSystemName();
    if (systemName) {
      document.title = systemName;
    }
    let logo = getLogo();
    if (logo) {
      let linkElement = document.querySelector("link[rel~='icon']");
      if (linkElement) {
        linkElement.href = logo;
      }
    }
  }, []);

  useEffect(() => {
    let preferredLang;

    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) {
        preferredLang = normalizeLanguage(savedLang);
      }
    }

    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) {
        i18n.changeLanguage(preferredLang);
      }
    }
  }, [i18n, userState?.user?.setting]);

  return (
    <div
      className='app-layout'
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isMobile ? 'auto' : '100dvh',
        overflow: isMobile ? 'visible' : 'hidden',
      }}
    >
      <header
        style={{
          padding: 0,
          height: 'auto',
          lineHeight: 'normal',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 100,
        }}
      >
        <HeaderBar
          onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)}
          drawerOpen={drawerOpen}
        />
      </header>
      <div
        style={{
          overflow: isMobile ? 'visible' : 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? 'auto' : '100dvh',
        }}
      >
        {showSider && (
          <aside
            className='app-sider'
            style={{
              position: 'fixed',
              left: 0,
              top: '64px',
              zIndex: 99,
              border: 'none',
              paddingRight: '0',
              width: 'var(--sidebar-current-width)',
            }}
          >
            <SiderBar
              onNavigate={() => {
                if (isMobile) setDrawerOpen(false);
              }}
            />
          </aside>
        )}
        <div
          style={{
            marginLeft: isMobile
              ? '0'
              : showSider
                ? 'var(--sidebar-current-width)'
                : '0',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: isMobile ? 'auto' : '100dvh',
          }}
        >
          <main
            style={{
              // Use flex: 1 1 0 (with minHeight: 0) so <main> shrinks to
              // its parent rather than growing to its content. Without
              // this, flex: 1 0 auto kept <main> at content height, the
              // grandparent's overflow: hidden clipped the bottom, and
              // <main>'s own overflowY: auto never engaged. Pages that
              // already pad past the fixed 64px header (e.g. mt-[60px])
              // continue to render correctly inside the scrollable region.
              flex: isMobile ? '1 1 auto' : '1 1 0',
              minHeight: 0,
              overflowY: isMobile ? 'visible' : 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: shouldInnerPadding ? (isMobile ? '5px' : '24px') : '0',
              position: 'relative',
            }}
          >
            <ErrorBoundary key={location.pathname}>
              <App />
            </ErrorBoundary>
            {!shouldHideFooter && (
              <footer
                style={{
                  width: '100%',
                }}
              >
                <FooterBar />
              </footer>
            )}
          </main>
        </div>
      </div>
      <ToastViewport />
    </div>
  );
};

export default PageLayout;
