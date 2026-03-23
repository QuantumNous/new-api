import React from 'react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import ActionButtons from './ActionButtons';
import MarketingHeader from './MarketingHeader';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const {
    userState,
    statusState,
    isMobile,
    collapsed,
    logoLoaded,
    currentLang,
    location,
    isLoading,
    systemName,
    logo,
    isNewYear,
    isSelfUseMode,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    headerNavModules,
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

  const { mainNavLinks } = useNavigation(t, headerNavModules);
  const marketingRoutes = [
    '/',
    '/pricing',
    '/docs',
    '/about',
    '/login',
    '/register',
    '/reset',
    '/user/reset',
  ];
  const isMarketingRoute = marketingRoutes.includes(location.pathname);
  const visibleMainNavLinks = isConsoleRoute
    ? mainNavLinks.filter(
        (link) =>
          !['console', 'pricing', 'docs', 'home', 'about'].includes(
            link.itemKey,
          ),
      )
    : mainNavLinks;

  if (isMarketingRoute) {
    return (
      <header className='app-header-shell app-header-shell--marketing text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300'>
        <NoticeModal
          visible={noticeVisible}
          onClose={handleNoticeClose}
          isMobile={isMobile}
          defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
          unreadKeys={getUnreadKeys()}
        />

        <MarketingHeader
          mainNavLinks={visibleMainNavLinks}
          isMobile={isMobile}
          logo={logo}
          logoLoaded={logoLoaded}
          isLoading={isLoading}
          systemName={systemName}
          isSelfUseMode={isSelfUseMode}
          isDemoSiteMode={isDemoSiteMode}
          unreadCount={unreadCount}
          onNoticeOpen={handleNoticeOpen}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          currentLang={currentLang}
          onLanguageChange={handleLanguageChange}
          userState={userState}
          logout={logout}
          navigate={navigate}
          currentPath={location.pathname}
          t={t}
        />
      </header>
    );
  }

  return (
    <header className='app-header-shell text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <div className='app-header-shell__frame'>
        <div className='app-header-shell__content'>
          <div className='flex items-center'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              collapsed={collapsed}
              onToggle={handleMobileMenuToggle}
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

          {visibleMainNavLinks.length > 0 && (
            <Navigation
              mainNavLinks={visibleMainNavLinks}
              isMobile={isMobile}
              isLoading={isLoading}
              userState={userState}
            />
          )}

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
    </header>
  );
};

export default HeaderBar;
