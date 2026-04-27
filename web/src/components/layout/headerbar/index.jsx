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

import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '@heroui-pro/react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import MobileNavMenu from './MobileNavMenu';
import ActionButtons from './ActionButtons';

const HeaderBar = () => {
  const {
    userState,
    statusState,
    isMobile,
    logoLoaded,
    currentLang,
    isLoading,
    systemName,
    logo,
    isNewYear,
    isSelfUseMode,
    docsLink,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    headerNavModules,
    pricingRequireAuth,
    logout,
    handleLanguageChange,
    handleThemeToggle,
    navigate,
    t,
  } = useHeaderBar();

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  const { mainNavLinks } = useNavigation(t, docsLink, headerNavModules);
  const { pathname } = useLocation();

  // Bridge Navbar's `navigate` prop with react-router. External URLs are
  // delegated to the browser (Navbar opens them in a new tab itself when the
  // href starts with http(s)://) so we only intercept internal hrefs.
  const handleNavbarNavigate = useCallback(
    (href) => {
      if (!href) return;
      if (/^https?:\/\//i.test(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(href);
    },
    [navigate],
  );

  // Mobile menu (Navbar.MenuToggle + Navbar.Menu) only makes sense on public
  // routes. On console routes the mobile menu is the sidebar drawer, which is
  // toggled via `MobileMenuButton`.
  const showMobileMenuToggle = !isConsoleRoute;

  return (
    <>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <Navbar
        position='static'
        maxWidth='full'
        shouldBlockScroll={false}
        navigate={handleNavbarNavigate}
        className='border-b border-border bg-background text-foreground'
        aria-label={t('主导航')}
      >
        <Navbar.Header className='gap-2 px-2 md:gap-3 md:px-4'>
          <MobileMenuButton
            isConsoleRoute={isConsoleRoute}
            isMobile={isMobile}
            t={t}
          />

          <Navbar.Brand>
            <HeaderLogo
              isMobile={isMobile}
              isConsoleRoute={isConsoleRoute}
              logo={logo}
              logoLoaded={logoLoaded}
              isLoading={isLoading}
              systemName={systemName}
              isSelfUseMode={isSelfUseMode}
              isDemoSiteMode={isDemoSiteMode}
              t={t}
            />
          </Navbar.Brand>

          <Navigation
            mainNavLinks={mainNavLinks}
            isLoading={isLoading}
            userState={userState}
            pricingRequireAuth={pricingRequireAuth}
            pathname={pathname}
          />

          <Navbar.Spacer />

          <Navbar.Content className='gap-2 md:gap-3'>
            <ActionButtons
              isNewYear={isNewYear}
              unreadCount={unreadCount}
              onNoticeOpen={handleNoticeOpen}
              theme={theme}
              onThemeToggle={handleThemeToggle}
              currentLang={currentLang}
              onLanguageChange={handleLanguageChange}
              userState={userState}
              isLoading={isLoading}
              isMobile={isMobile}
              isSelfUseMode={isSelfUseMode}
              logout={logout}
              navigate={navigate}
              t={t}
            />
          </Navbar.Content>

          {showMobileMenuToggle && (
            <Navbar.MenuToggle className='md:hidden' srLabel={t('打开菜单')} />
          )}
        </Navbar.Header>

        {showMobileMenuToggle && (
          <MobileNavMenu
            mainNavLinks={mainNavLinks}
            userState={userState}
            pricingRequireAuth={pricingRequireAuth}
            pathname={pathname}
          />
        )}
      </Navbar>
    </>
  );
};

export default HeaderBar;
