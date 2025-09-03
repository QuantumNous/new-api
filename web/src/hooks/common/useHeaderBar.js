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

import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useSetTheme, useTheme, useActualTheme } from '../../context/Theme';
import { getLogo, getSystemName, API, showSuccess } from '../../helpers';
import { useIsMobile } from './useIsMobile';
import { useSidebarCollapsed } from './useSidebarCollapsed';
import { useMinimumLoadingTime } from './useMinimumLoadingTime';

export const useHeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [logoLoaded, setLogoLoaded] = useState(false);
  const navigate = useNavigate();
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const location = useLocation();

  const loading = statusState?.status === undefined;
  const isLoading = useMinimumLoadingTime(loading);

  const systemName = getSystemName();
  const logo = getLogo();
  const currentDate = new Date();
  const isNewYear = currentDate.getMonth() === 0 && currentDate.getDate() === 1;

  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;

  // 获取顶栏模块配置
  const headerNavModulesConfig = statusState?.status?.HeaderNavModules;

  // 使用useMemo确保headerNavModules正确响应statusState变化
  const headerNavModules = useMemo(() => {
    if (headerNavModulesConfig) {
      try {
        const modules = JSON.parse(headerNavModulesConfig);

        // 处理向后兼容性：如果pricing是boolean，转换为对象格式
        if (typeof modules.pricing === 'boolean') {
          modules.pricing = {
            enabled: modules.pricing,
            requireAuth: false, // 默认不需要登录鉴权
          };
        }

        return modules;
      } catch (error) {
        console.error('解析顶栏模块配置失败:', error);
        return null;
      }
    }
    return null;
  }, [headerNavModulesConfig]);

  // 获取模型广场权限配置
  const pricingRequireAuth = useMemo(() => {
    if (headerNavModules?.pricing) {
      return typeof headerNavModules.pricing === 'object'
        ? headerNavModules.pricing.requireAuth
        : false; // 默认不需要登录
    }
    return false; // 默认不需要登录
  }, [headerNavModules]);

  const isConsoleRoute = location.pathname.startsWith('/console');

  const theme = useTheme();
  const actualTheme = useActualTheme();
  const setTheme = useSetTheme();

  // Logo loading effect
  useEffect(() => {
    setLogoLoaded(false);
    if (!logo) return;
    const img = new Image();
    img.src = logo;
    img.onload = () => setLogoLoaded(true);
  }, [logo]);

  // Send theme to iframe
  useEffect(() => {
    try {
      const iframe = document.querySelector('iframe');
      const cw = iframe && iframe.contentWindow;
      if (cw) {
        cw.postMessage({ themeMode: actualTheme }, '*');
      }
    } catch (e) {
      // Silently ignore cross-origin or access errors
    }
  }, [actualTheme]);

  // Language change effect
  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      setCurrentLang(lng);
      try {
        const iframe = document.querySelector('iframe');
        const cw = iframe && iframe.contentWindow;
        if (cw) {
          cw.postMessage({ lang: lng }, '*');
        }
      } catch (e) {
        // Silently ignore cross-origin or access errors
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  // Actions
  const logout = useCallback(async () => {
    await API.get('/api/user/logout');
    showSuccess(t('注销成功!'));
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate, t, userDispatch]);

  const handleLanguageChange = useCallback(
    (lang) => {
      i18n.changeLanguage(lang);
    },
    [i18n],
  );

  const handleThemeToggle = useCallback(
    (newTheme) => {
      if (
        !newTheme ||
        (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'auto')
      ) {
        return;
      }
      setTheme(newTheme);
    },
    [setTheme],
  );

  const handleMobileMenuToggle = useCallback(() => {
    if (isMobile) {
      onMobileMenuToggle();
    } else {
      toggleCollapsed();
    }
  }, [isMobile, onMobileMenuToggle, toggleCollapsed]);

  return {
    // State
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
    docsLink,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    drawerOpen,
    headerNavModules,
    pricingRequireAuth,

    // Actions
    logout,
    handleLanguageChange,
    handleThemeToggle,
    handleMobileMenuToggle,
    navigate,
    t,
  };
};
