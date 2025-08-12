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

import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../../context/User/index.js';
import { useSetTheme, useTheme } from '../../context/Theme/index.js';
import { useTranslation } from 'react-i18next';
import { API, getLogo, getSystemName, showSuccess, stringToColor } from '../../helpers/index.js';
import fireworks from 'react-fireworks';
import { CN, GB } from 'country-flag-icons/react/3x2';
import NoticeModal from './NoticeModal.js';

import {
  IconClose,
  IconMenu,
  IconLanguage,
  IconChevronDown,
  IconSun,
  IconMoon,
  IconExit,
  IconUserSetting,
  IconCreditCard,
  IconKey,
  IconBell,
} from '@douyinfe/semi-icons';
import {
  Avatar,
  Button,
  Dropdown,
  Tag,
  Typography,
  Skeleton,
  Badge,
} from '@douyinfe/semi-ui';
import { StatusContext } from '../../context/Status/index.js';
import { useIsMobile } from '../../hooks/common/useIsMobile.js';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed.js';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime.js';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [logoLoaded, setLogoLoaded] = useState(false);
  let navigate = useNavigate();
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loading = statusState?.status === undefined;
  const isLoading = useMinimumLoadingTime(loading);

  const systemName = getSystemName();
  const logo = getLogo();
  const currentDate = new Date();
  const isNewYear = currentDate.getMonth() === 0 && currentDate.getDate() === 1;

  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;

  const isConsoleRoute = location.pathname.startsWith('/console');

  const theme = useTheme();
  const setTheme = useSetTheme();

  const announcements = statusState?.status?.announcements || [];

  const getAnnouncementKey = (a) => `${a?.publishDate || ''}-${(a?.content || '').slice(0, 30)}`;

  const calculateUnreadCount = () => {
    if (!announcements.length) return 0;
    let readKeys = [];
    try {
      readKeys = JSON.parse(localStorage.getItem('notice_read_keys')) || [];
    } catch (_) {
      readKeys = [];
    }
    const readSet = new Set(readKeys);
    return announcements.filter((a) => !readSet.has(getAnnouncementKey(a))).length;
  };

  const getUnreadKeys = () => {
    if (!announcements.length) return [];
    let readKeys = [];
    try {
      readKeys = JSON.parse(localStorage.getItem('notice_read_keys')) || [];
    } catch (_) {
      readKeys = [];
    }
    const readSet = new Set(readKeys);
    return announcements.filter((a) => !readSet.has(getAnnouncementKey(a))).map(getAnnouncementKey);
  };

  useEffect(() => {
    setUnreadCount(calculateUnreadCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements]);

  const mainNavLinks = [
    {
      text: t('首页'),
      itemKey: 'home',
      to: '/',
    },
    {
      text: t('控制台'),
      itemKey: 'console',
      to: '/console',
    },
    {
      text: t('模型广场'),
      itemKey: 'pricing',
      to: '/pricing',
    },
    ...(docsLink
      ? [
        {
          text: t('文档'),
          itemKey: 'docs',
          isExternal: true,
          externalLink: docsLink,
        },
      ]
      : []),
    {
      text: t('关于'),
      itemKey: 'about',
      to: '/about',
    },
  ];

  async function logout() {
    await API.get('/api/user/logout');
    showSuccess(t('注销成功!'));
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
    setMobileMenuOpen(false);
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
    }, 3000);
  };

  const handleNoticeOpen = () => {
    setNoticeVisible(true);
  };

  const handleNoticeClose = () => {
    setNoticeVisible(false);
    if (announcements.length) {
      let readKeys = [];
      try {
        readKeys = JSON.parse(localStorage.getItem('notice_read_keys')) || [];
      } catch (_) {
        readKeys = [];
      }
      const mergedKeys = Array.from(new Set([...readKeys, ...announcements.map(getAnnouncementKey)]));
      localStorage.setItem('notice_read_keys', JSON.stringify(mergedKeys));
    }
    setUnreadCount(0);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }

    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.contentWindow.postMessage({ themeMode: theme }, '*');
    }

  }, [theme, isNewYear]);

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      setCurrentLang(lng);
      const iframe = document.querySelector('iframe');
      if (iframe) {
        iframe.contentWindow.postMessage({ lang: lng }, '*');
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  useEffect(() => {
    setLogoLoaded(false);
    if (!logo) return;
    const img = new Image();
    img.src = logo;
    img.onload = () => setLogoLoaded(true);
  }, [logo]);

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setMobileMenuOpen(false);
  };

  const handleNavLinkClick = (itemKey) => {
    if (itemKey === 'home') {
      // styleDispatch(styleActions.setSider(false)); // This line is removed
    }
    setMobileMenuOpen(false);
  };

  const renderNavLinks = (isMobileView = false, isLoading = false) => {
    if (isLoading) {
      const skeletonLinkClasses = isMobileView
        ? 'flex items-center gap-1 p-3 w-full rounded-md'
        : 'flex items-center gap-1 p-2 rounded-md';
      return Array(4)
        .fill(null)
        .map((_, index) => (
          <div key={index} className={skeletonLinkClasses}>
            <Skeleton
              loading={true}
              active
              placeholder={
                <Skeleton.Title
                  active
                  style={{ width: isMobileView ? 100 : 60, height: 16 }}
                />
              }
            />
          </div>
        ));
    }

    return mainNavLinks.map((link) => {
      const commonLinkClasses = isMobileView
        ? 'flex items-center gap-1 p-3 w-full text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors font-semibold'
        : 'flex items-center gap-1 p-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-md font-semibold';

      const linkContent = (
        <span>{link.text}</span>
      );

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={commonLinkClasses}
            onClick={() => handleNavLinkClick(link.itemKey)}
          >
            {linkContent}
          </a>
        );
      }

      let targetPath = link.to;
      if (link.itemKey === 'console' && !userState.user) {
        targetPath = '/login';
      }

      return (
        <Link
          key={link.itemKey}
          to={targetPath}
          className={commonLinkClasses}
          onClick={() => handleNavLinkClick(link.itemKey)}
        >
          {linkContent}
        </Link>
      );
    });
  };

  const renderUserArea = () => {
    if (isLoading) {
      return (
        <div className="flex items-center p-1 rounded-full bg-semi-color-fill-0 dark:bg-semi-color-fill-1">
          <Skeleton
            loading={true}
            active
            placeholder={<Skeleton.Avatar active size="extra-small" className="shadow-sm" />}
          />
          <div className="ml-1.5 mr-1">
            <Skeleton
              loading={true}
              active
              placeholder={
                <Skeleton.Title
                  active
                  style={{ width: isMobile ? 15 : 50, height: 12 }}
                />
              }
            />
          </div>
        </div>
      );
    }

    if (userState.user) {
      return (
        <Dropdown
          position="bottomRight"
          render={
            <Dropdown.Menu className="!bg-semi-color-bg-overlay !border-semi-color-border !shadow-lg !rounded-lg dark:!bg-gray-700 dark:!border-gray-600">
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/personal');
                  setMobileMenuOpen(false);
                }}
                className="!px-3 !py-1.5 !text-sm !text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:!text-gray-200 dark:hover:!bg-blue-500 dark:hover:!text-white"
              >
                <div className="flex items-center gap-2">
                  <IconUserSetting size="small" className="text-gray-500 dark:text-gray-400" />
                  <span>{t('个人设置')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/token');
                  setMobileMenuOpen(false);
                }}
                className="!px-3 !py-1.5 !text-sm !text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:!text-gray-200 dark:hover:!bg-blue-500 dark:hover:!text-white"
              >
                <div className="flex items-center gap-2">
                  <IconKey size="small" className="text-gray-500 dark:text-gray-400" />
                  <span>{t('令牌管理')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/topup');
                  setMobileMenuOpen(false);
                }}
                className="!px-3 !py-1.5 !text-sm !text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:!text-gray-200 dark:hover:!bg-blue-500 dark:hover:!text-white"
              >
                <div className="flex items-center gap-2">
                  <IconCreditCard size="small" className="text-gray-500 dark:text-gray-400" />
                  <span>{t('钱包')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item onClick={logout} className="!px-3 !py-1.5 !text-sm !text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:!text-gray-200 dark:hover:!bg-red-500 dark:hover:!text-white">
                <div className="flex items-center gap-2">
                  <IconExit size="small" className="text-gray-500 dark:text-gray-400" />
                  <span>{t('退出')}</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            theme="borderless"
            type="tertiary"
            className="flex items-center gap-1.5 !p-1 !rounded-full hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-700 !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2"
          >
            <Avatar
              size="extra-small"
              color={stringToColor(userState.user.username)}
              className="mr-1"
            >
              {userState.user.username[0].toUpperCase()}
            </Avatar>
            <span className="hidden md:inline">
              <Typography.Text className="!text-xs !font-medium !text-semi-color-text-1 dark:!text-gray-300 mr-1">
                {userState.user.username}
              </Typography.Text>
            </span>
            <IconChevronDown className="text-xs text-semi-color-text-2 dark:text-gray-400" />
          </Button>
        </Dropdown>
      );
    } else {
      const showRegisterButton = !isSelfUseMode;

      const commonSizingAndLayoutClass = "flex items-center justify-center !py-[10px] !px-1.5";

      const loginButtonSpecificStyling = "!bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-700 transition-colors";
      let loginButtonClasses = `${commonSizingAndLayoutClass} ${loginButtonSpecificStyling}`;

      let registerButtonClasses = `${commonSizingAndLayoutClass}`;

      const loginButtonTextSpanClass = "!text-xs !text-semi-color-text-1 dark:!text-gray-300 !p-1.5";
      const registerButtonTextSpanClass = "!text-xs !text-white !p-1.5";

      if (showRegisterButton) {
        if (isMobile) {
          loginButtonClasses += " !rounded-full";
        } else {
          loginButtonClasses += " !rounded-l-full !rounded-r-none";
        }
        registerButtonClasses += " !rounded-r-full !rounded-l-none";
      } else {
        loginButtonClasses += " !rounded-full";
      }

      return (
        <div className="flex items-center">
          <Link to="/login" onClick={() => handleNavLinkClick('login')} className="flex">
            <Button
              theme="borderless"
              type="tertiary"
              className={loginButtonClasses}
            >
              <span className={loginButtonTextSpanClass}>
                {t('登录')}
              </span>
            </Button>
          </Link>
          {showRegisterButton && (
            <div className="hidden md:block">
              <Link to="/register" onClick={() => handleNavLinkClick('register')} className="flex -ml-px">
                <Button
                  theme="solid"
                  type="primary"
                  className={registerButtonClasses}
                >
                  <span className={registerButtonTextSpanClass}>
                    {t('注册')}
                  </span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <header className="text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-lg">
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />
      <div className="w-full px-2">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="md:hidden">
              <Button
                icon={
                  isConsoleRoute
                    ? ((isMobile ? drawerOpen : collapsed) ? <IconClose className="text-lg" /> : <IconMenu className="text-lg" />)
                    : (mobileMenuOpen ? <IconClose className="text-lg" /> : <IconMenu className="text-lg" />)
                }
                aria-label={
                  isConsoleRoute
                    ? ((isMobile ? drawerOpen : collapsed) ? t('关闭侧边栏') : t('打开侧边栏'))
                    : (mobileMenuOpen ? t('关闭菜单') : t('打开菜单'))
                }
                onClick={() => {
                  if (isConsoleRoute) {
                    // 控制侧边栏的显示/隐藏，无论是否移动设备
                    isMobile ? onMobileMenuToggle() : toggleCollapsed();
                  } else {
                    // 控制HeaderBar自己的移动菜单
                    setMobileMenuOpen(!mobileMenuOpen);
                  }
                }}
                theme="borderless"
                type="tertiary"
                className="!p-2 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700"
              />
            </div>
            <Link to="/" onClick={() => handleNavLinkClick('home')} className="flex items-center gap-2 group ml-2">
              <div className="relative w-8 h-8 md:w-8 md:h-8">
                {(isLoading || !logoLoaded) && (
                  <Skeleton.Image
                    active
                    className="absolute inset-0 !rounded-full"
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                <img
                  src={logo}
                  alt="logo"
                  className={`absolute inset-0 w-full h-full transition-opacity duration-200 group-hover:scale-105 rounded-full ${(!isLoading && logoLoaded) ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton
                    loading={isLoading}
                    active
                    placeholder={
                      <Skeleton.Title
                        active
                        style={{ width: 120, height: 24 }}
                      />
                    }
                  >
                    <Typography.Title heading={4} className="!text-lg !font-semibold !mb-0">
                      {systemName}
                    </Typography.Title>
                  </Skeleton>
                  {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
                    <Tag
                      color={isSelfUseMode ? 'purple' : 'blue'}
                      className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
                      size="small"
                      shape='circle'
                    >
                      {isSelfUseMode ? t('自用模式') : t('演示站点')}
                    </Tag>
                  )}
                </div>
              </div>
            </Link>
            {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
              <div className="md:hidden">
                <Tag
                  color={isSelfUseMode ? 'purple' : 'blue'}
                  className="ml-2 text-xs px-1 py-0.5 rounded whitespace-nowrap shadow-sm"
                  size="small"
                  shape='circle'
                >
                  {isSelfUseMode ? t('自用模式') : t('演示站点')}
                </Tag>
              </div>
            )}

            <nav className="hidden md:flex items-center gap-1 lg:gap-2 ml-6">
              {renderNavLinks(false, isLoading)}
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {isNewYear && (
              <Dropdown
                position="bottomRight"
                render={
                  <Dropdown.Menu className="!bg-semi-color-bg-overlay !border-semi-color-border !shadow-lg !rounded-lg dark:!bg-gray-700 dark:!border-gray-600">
                    <Dropdown.Item onClick={handleNewYearClick} className="!text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:!text-gray-200 dark:hover:!bg-gray-600">
                      Happy New Year!!! 🎉
                    </Dropdown.Item>
                  </Dropdown.Menu>
                }
              >
                <Button
                  theme="borderless"
                  type="tertiary"
                  icon={<span className="text-xl">🎉</span>}
                  aria-label="New Year"
                  className="!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 rounded-full"
                />
              </Dropdown>
            )}

            {unreadCount > 0 ? (
              <Badge count={unreadCount} type="danger" overflowCount={99}>
                <Button
                  icon={<IconBell className="text-lg" />}
                  aria-label={t('系统公告')}
                  onClick={handleNoticeOpen}
                  theme="borderless"
                  type="tertiary"
                  className="!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2"
                />
              </Badge>
            ) : (
              <Button
                icon={<IconBell className="text-lg" />}
                aria-label={t('系统公告')}
                onClick={handleNoticeOpen}
                theme="borderless"
                type="tertiary"
                className="!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2"
              />
            )}

            <Button
              icon={theme === 'dark' ? <IconSun size="large" className="text-yellow-500" /> : <IconMoon size="large" className="text-gray-300" />}
              aria-label={t('切换主题')}
              onClick={() => setTheme(theme === 'dark' ? false : true)}
              theme="borderless"
              type="tertiary"
              className="!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2"
            />

            <Dropdown
              position="bottomRight"
              render={
                <Dropdown.Menu className="!bg-semi-color-bg-overlay !border-semi-color-border !shadow-lg !rounded-lg dark:!bg-gray-700 dark:!border-gray-600">
                  <Dropdown.Item
                    onClick={() => handleLanguageChange('zh')}
                    className={`!flex !items-center !gap-2 !px-3 !py-1.5 !text-sm !text-semi-color-text-0 dark:!text-gray-200 ${currentLang === 'zh' ? '!bg-semi-color-primary-light-default dark:!bg-blue-600 !font-semibold' : 'hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-600'}`}
                  >
                    <CN title="中文" className="!w-5 !h-auto" />
                    <span>中文</span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleLanguageChange('en')}
                    className={`!flex !items-center !gap-2 !px-3 !py-1.5 !text-sm !text-semi-color-text-0 dark:!text-gray-200 ${currentLang === 'en' ? '!bg-semi-color-primary-light-default dark:!bg-blue-600 !font-semibold' : 'hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-600'}`}
                  >
                    <GB title="English" className="!w-5 !h-auto" />
                    <span>English</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Button
                icon={<IconLanguage className="text-lg" />}
                aria-label={t('切换语言')}
                theme="borderless"
                type="tertiary"
                className="!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2"
              />
            </Dropdown>

            {renderUserArea()}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div
          className={`
            absolute top-16 left-0 right-0 bg-semi-color-bg-0 
            shadow-lg p-3
            transform transition-all duration-300 ease-in-out
            ${(!isConsoleRoute && mobileMenuOpen) ? 'translate-y-0 opacity-100 visible' : '-translate-y-4 opacity-0 invisible'}
          `}
        >
          <nav className="flex flex-col gap-1">
            {renderNavLinks(true, isLoading)}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
