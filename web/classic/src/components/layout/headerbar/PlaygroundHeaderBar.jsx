import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Tag, Typography } from '@douyinfe/semi-ui';
import './HeaderBar.css';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import NoticeModal from '../NoticeModal';
import ActionButtons from './ActionButtons';
import SkeletonWrapper from '../components/SkeletonWrapper';

const PLAYGROUND_NAV_ITEMS = [
  {
    key: 'console',
    labelKey: '控制台',
    to: '/console',
  },
  {
    key: 'playground',
    labelKey: '操练场',
    to: '/console/playground',
  },
  {
    key: 'image-playground',
    labelKey: '图片',
    to: '/console/image-playground',
  },
  {
    key: 'video-playground',
    labelKey: '视频',
    to: '/console/video-playground',
  },
];

const PlaygroundHeaderBar = ({
  onMobileMenuToggle = () => {},
  drawerOpen = false,
  collapsed = false,
  onDesktopCollapseToggle = () => {},
}) => {
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
    isDemoSiteMode,
    theme,
    logout,
    handleLanguageChange,
    handleThemeToggle,
    navigate,
    t,
  } = useHeaderBar({
    onMobileMenuToggle,
    drawerOpen,
    collapsed,
    onDesktopCollapseToggle,
  });

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  return (
    <header className='app-header text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300 app-header-console'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <div className='w-full px-2 md:px-4 app-header-shell'>
        <div className='app-header-inner flex items-center justify-between h-16 gap-4'>
          <div className='playground-header-left flex items-center min-w-0'>
            <Link
              to='/'
              className='app-header-brand group flex items-center gap-3 flex-shrink-0'
            >
              <div className='app-header-brand-mark relative w-9 h-9 md:w-9 md:h-9'>
                <SkeletonWrapper loading={isLoading || !logoLoaded} type='image' />
                <img
                  src={logo}
                  alt='logo'
                  className={`app-header-brand-logo absolute inset-0 w-full h-full transition-all duration-200 group-hover:scale-110 p-1 ${!isLoading && logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
              <div className='app-header-brand-copy hidden md:flex items-center gap-2'>
                <div className='flex items-center gap-2'>
                  <SkeletonWrapper
                    loading={isLoading}
                    type='title'
                    width={120}
                    height={24}
                  >
                    <Typography.Title
                      heading={4}
                      className='app-header-brand-title !text-lg !font-semibold !mb-0'
                    >
                      {systemName}
                    </Typography.Title>
                  </SkeletonWrapper>
                  {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
                    <Tag
                      color={isSelfUseMode ? 'purple' : 'blue'}
                      className='app-header-brand-tag text-xs px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm'
                      size='small'
                      shape='circle'
                    >
                      {isSelfUseMode ? t('自用模式') : t('演示站点')}
                    </Tag>
                  )}
                </div>
              </div>
            </Link>

            <nav className='playground-header-nav flex items-center gap-1 md:gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide'>
              {PLAYGROUND_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.key === 'console'}
                  className={({ isActive }) =>
                    `app-header-nav-link playground-header-nav-link flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out px-2 py-3 ${
                      isActive ? 'is-active' : ''
                    }`
                  }
                >
                  <span className='app-header-nav-link-text playground-header-nav-text'>
                    {t(item.labelKey)}
                  </span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className='app-header-actions'>
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
    </header>
  );
};

export default PlaygroundHeaderBar;
