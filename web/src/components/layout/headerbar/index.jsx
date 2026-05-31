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

import React, { useState, useEffect, useCallback } from 'react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import { useActualTheme } from '../../../context/Theme';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import MobileNavPanel from './MobileNavPanel';
import ActionButtons from './ActionButtons';

const useScrollY = () => {
  const [scrollY, setScrollY] = useState(0);

  const onScroll = useCallback(() => {
    setScrollY(window.scrollY || window.pageYOffset || 0);
  }, []);

  useEffect(() => {
    let frameId = 0;
    let ticking = false;

    const handler = () => {
      if (ticking) return;
      ticking = true;
      frameId = window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    };

    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('scroll', handler);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [onScroll]);

  return scrollY;
};

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const {
    userState,
    statusState,
    isMobile,
    collapsed,
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
    handleMobileMenuToggle,
    navigate,
    t,
  } = useHeaderBar({ onMobileMenuToggle, drawerOpen });

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  const { mainNavLinks } = useNavigation(t, docsLink, headerNavModules);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleMobileNavToggle = useCallback(() => {
    setMobileNavOpen((prev) => !prev);
  }, []);

  const handleMobileNavClose = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const isDark = useActualTheme() === 'dark';
  const scrollY = useScrollY();
  const scrolled = scrollY > 12;

  return (
    <header
      className='text-semi-color-text-0 backdrop-blur-[18px]'
      style={{
        background: isDark
          ? scrolled ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.7)'
          : scrolled ? 'rgba(248, 250, 252, 0.96)' : 'rgba(248, 250, 252, 0.75)',
        borderBottom: scrolled
          ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
          : '1px solid transparent',
        transition: 'background 200ms ease, border-color 200ms ease',
      }}
    >
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <div className='mx-auto w-full max-w-[1248px] px-4 md:px-6'>
        <div className='flex h-14 items-center gap-3 md:h-16 md:gap-6'>
          <div className='flex shrink-0 items-center gap-2 md:gap-3'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              mobileNavOpen={mobileNavOpen}
              collapsed={collapsed}
              onToggle={isConsoleRoute ? handleMobileMenuToggle : handleMobileNavToggle}
              t={t}
            />

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
          </div>

          <div className='ml-auto flex min-w-0 items-center gap-2 md:gap-4 lg:gap-5'>
            <Navigation
              mainNavLinks={mainNavLinks}
              isMobile={isMobile}
              isLoading={isLoading}
              userState={userState}
              pricingRequireAuth={pricingRequireAuth}
            />

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
          </div>
        </div>
      </div>

      {isMobile && !isConsoleRoute && (
        <MobileNavPanel
          open={mobileNavOpen}
          mainNavLinks={mainNavLinks}
          userState={userState}
          pricingRequireAuth={pricingRequireAuth}
          onClose={handleMobileNavClose}
        />
      )}
    </header>
  );
};

export default HeaderBar;
