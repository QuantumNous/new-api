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
import {
  PageHeaderProvider,
  usePageHeaderContent,
} from './PageHeaderContext';
import React, { useCallback, useContext, useEffect } from 'react';
import { Sidebar, useSidebar } from '@heroui-pro/react';
import { PanelLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { normalizeLanguage } from '../../i18n/language';

// Bridges the existing localStorage-backed sidebar collapsed flag with
// `Sidebar.Provider`'s open/onOpenChange API. Reading the cookie or
// localStorage at module load gives the initial value with no flash.
const SIDEBAR_COLLAPSED_KEY = 'default_collapse_sidebar';
const readSidebarDefaultOpen = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true';
  } catch {
    return true;
  }
};

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
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

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

  // Persist sidebar open state back to localStorage so refresh / cross-tab
  // matches the previous behavior of `useSidebarCollapsed`.
  const handleSidebarOpenChange = useCallback((open) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, (!open).toString());
    } catch {
      // Ignore quota / privacy errors — Sidebar.Provider keeps state in memory.
    }
  }, []);

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

  // Hoist Sidebar.Provider to the root so HeaderBar (mobile menu toggle) and
  // SiderBar both have access to `useSidebar()`. The provider's default flex
  // layout is overridden to flex-col via className so our fixed header can
  // sit on top of the sidebar+main row.
  return (
    <Sidebar.Provider
      defaultOpen={readSidebarDefaultOpen()}
      onOpenChange={handleSidebarOpenChange}
      navigate={navigate}
      collapsible='icon'
      // Constrain to viewport height + clip overflow so the *main* element
      // becomes the scroll container instead of the document body. Without
      // this, tall console pages caused the whole page (sidebar included)
      // to scroll, which broke the sticky-sidebar UX.
      className='app-layout flex !flex-col h-dvh overflow-hidden'
    >
      <PageHeaderProvider>
        <header className='shrink-0 z-50 w-full'>
          <HeaderBar />
        </header>

        <div className='flex flex-1 min-h-0 w-full'>
          {isConsoleRoute && <SiderBar />}

          {/*
            Right content column. On console routes we render a single
            page-header row above <main> that hosts the sidebar collapse
            trigger plus any title/actions a page contributes via
            `usePageHeader(...)`. This mirrors heroui-pro's AppLayout where
            the trigger lives in the navbar row at the top of the body
            column — and lets pages like Dashboard place their greeting on
            the same row instead of stacking it below.
          */}
          <div className='flex flex-1 min-w-0 flex-col'>
            {isConsoleRoute && <ConsolePageHeader t={t} />}

            {/*
              Padding lives on an inner wrapper rather than on <main> itself.
              Putting `padding-bottom` directly on a `overflow-y: auto`
              container causes the bottom gap to disappear when content
              overflows (browsers treat the padding-bottom as part of the
              scroll viewport, not the scroll content). Moving it onto a
              normal block child preserves both top *and* bottom breathing
              room regardless of scroll state.
            */}
            <main
              className='flex-1 min-w-0 relative overflow-y-auto'
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className={shouldInnerPadding ? 'p-6' : ''}>
                <ErrorBoundary key={location.pathname}>
                  <App />
                </ErrorBoundary>
              </div>
              {!shouldHideFooter && (
                <footer className='w-full'>
                  <FooterBar />
                </footer>
              )}
            </main>
          </div>
        </div>

        <ToastViewport />
      </PageHeaderProvider>
    </Sidebar.Provider>
  );
};

// Single console page-header row: [trigger] [page title]      [page actions].
// Pages contribute their `title` / `actions` slots via the `usePageHeader`
// hook (see PageHeaderContext). Pages that don't push anything just get a
// trigger-only row, which keeps every console page visually consistent.
//
// On mobile the trigger is suppressed because `MobileMenuButton` in the
// global HeaderBar already toggles the same `Sidebar.Mobile` sheet —
// rendering both would put two identical controls within ~80px of each
// other. If a page also provides no title/actions, we hide the whole row
// so we don't leave an empty padding bar above content.
function ConsolePageHeader({ t }) {
  const { isOpen, isMobile } = useSidebar();
  const { title, actions } = usePageHeaderContent();

  if (isMobile && !title && !actions) {
    return null;
  }

  const label = isOpen ? t('收起侧边栏') : t('打开侧边栏');

  // Horizontal padding matches <main>'s 24px (`pt-1 pb-0` keeps the header
  // visually compact — the 24px gap below comes from <main>'s padding-top
  // alone, no double-spacing). Aligning to 24px makes the trigger button
  // and any page-supplied actions sit flush with the card edges below,
  // since console pages already render inside <main padding=24>.
  return (
    <div className='shrink-0 flex items-center justify-between gap-3 px-6 pt-3 pb-1'>
      <div className='flex items-center gap-3 min-w-0 flex-1'>
        {!isMobile && (
          <Sidebar.Trigger
            variant='tertiary'
            aria-label={label}
            className='rounded-full text-foreground hover:bg-surface-secondary shrink-0'
          >
            <PanelLeft size={19} strokeWidth={2.4} />
          </Sidebar.Trigger>
        )}
        {title}
      </div>
      {actions ? (
        <div className='flex items-center gap-1 shrink-0'>{actions}</div>
      ) : null}
    </div>
  );
}

export default PageLayout;
