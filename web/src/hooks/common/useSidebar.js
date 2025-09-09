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

import { useState, useEffect, useMemo, useContext } from 'react';
import { StatusContext } from '../../context/Status';
import { API } from '../../helpers';

export const useSidebar = () => {
  const [statusState] = useContext(StatusContext);
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // 默认配置
  const defaultAdminConfig = {
    chat: {
      enabled: true,
      playground: true,
      chat: true,
    },
    console: {
      enabled: true,
      detail: true,
      token: true,
      log: true,
      midjourney: true,
      task: true,
    },
    personal: {
      enabled: true,
      topup: true,
      personal: true,
    },
    admin: {
      enabled: true,
      channel: true,
      models: true,
      redemption: true,
      user: true,
      setting: true,
    },
  };

  // 获取管理员配置
  const adminConfig = useMemo(() => {
    if (statusState?.status?.SidebarModulesAdmin) {
      try {
        const config = JSON.parse(statusState.status.SidebarModulesAdmin);
        return config;
      } catch (error) {
        return defaultAdminConfig;
      }
    }
    return defaultAdminConfig;
  }, [statusState?.status?.SidebarModulesAdmin]);

  // 加载用户配置的通用方法
  const loadUserConfig = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/user/self');
      if (res.data.success && res.data.data.sidebar_modules) {
        let config;
        // 检查sidebar_modules是字符串还是对象
        if (typeof res.data.data.sidebar_modules === 'string') {
          config = JSON.parse(res.data.data.sidebar_modules);
        } else {
          config = res.data.data.sidebar_modules;
        }
        setUserConfig(config);
      } else {
        // 当用户没有配置时，生成一个基于管理员配置的默认用户配置
        // 这样可以确保权限控制正确生效
        const defaultUserConfig = {};
        Object.keys(adminConfig).forEach((sectionKey) => {
          if (adminConfig[sectionKey]?.enabled) {
            defaultUserConfig[sectionKey] = { enabled: true };
            // 为每个管理员允许的模块设置默认值为true
            Object.keys(adminConfig[sectionKey]).forEach((moduleKey) => {
              if (
                moduleKey !== 'enabled' &&
                adminConfig[sectionKey][moduleKey]
              ) {
                defaultUserConfig[sectionKey][moduleKey] = true;
              }
            });
          }
        });
        setUserConfig(defaultUserConfig);
      }
    } catch (error) {
      // 出错时也生成默认配置，而不是设置为空对象
      const defaultUserConfig = {};
      Object.keys(adminConfig).forEach((sectionKey) => {
        if (adminConfig[sectionKey]?.enabled) {
          defaultUserConfig[sectionKey] = { enabled: true };
          Object.keys(adminConfig[sectionKey]).forEach((moduleKey) => {
            if (moduleKey !== 'enabled' && adminConfig[sectionKey][moduleKey]) {
              defaultUserConfig[sectionKey][moduleKey] = true;
            }
          });
        }
      });
      setUserConfig(defaultUserConfig);
    } finally {
      setLoading(false);
    }
  };

  // 刷新用户配置的方法（供外部调用）
  const refreshUserConfig = async () => {
    if (Object.keys(adminConfig).length > 0) {
      await loadUserConfig();
    }
  };

  // 加载用户配置
  useEffect(() => {
    // 只有当管理员配置加载完成后才加载用户配置
    if (Object.keys(adminConfig).length > 0) {
      loadUserConfig();
    }
  }, [adminConfig]);

  // 计算最终的显示配置
  const finalConfig = useMemo(() => {
    const result = {};

    // 确保adminConfig已加载
    if (!adminConfig || Object.keys(adminConfig).length === 0) {
      return result;
    }

    // 如果userConfig未加载，等待加载完成
    if (!userConfig) {
      return result;
    }

    // 遍历所有区域
    Object.keys(adminConfig).forEach((sectionKey) => {
      const adminSection = adminConfig[sectionKey];
      const userSection = userConfig[sectionKey];

      // 如果管理员禁用了整个区域，则该区域不显示
      if (!adminSection?.enabled) {
        result[sectionKey] = { enabled: false };
        return;
      }

      // 区域级别：用户可以选择隐藏管理员允许的区域
      // 当userSection存在时检查enabled状态，否则默认为true
      const sectionEnabled = userSection ? userSection.enabled !== false : true;
      result[sectionKey] = { enabled: sectionEnabled };

      // 功能级别：只有管理员和用户都允许的功能才显示
      Object.keys(adminSection).forEach((moduleKey) => {
        if (moduleKey === 'enabled') return;

        const adminAllowed = adminSection[moduleKey];
        // 当userSection存在时检查模块状态，否则默认为true
        const userAllowed = userSection
          ? userSection[moduleKey] !== false
          : true;

        result[sectionKey][moduleKey] =
          adminAllowed && userAllowed && sectionEnabled;
      });
    });

    return result;
  }, [adminConfig, userConfig]);

  // 检查特定功能是否应该显示
  const isModuleVisible = (sectionKey, moduleKey = null) => {
    if (moduleKey) {
      return finalConfig[sectionKey]?.[moduleKey] === true;
    } else {
      return finalConfig[sectionKey]?.enabled === true;
    }
  };

  // 检查区域是否有任何可见的功能
  const hasSectionVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return false;

    return Object.keys(section).some(
      (key) => key !== 'enabled' && section[key] === true,
    );
  };

  // 获取区域的可见功能列表
  const getVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return [];

    return Object.keys(section).filter(
      (key) => key !== 'enabled' && section[key] === true,
    );
  };

  return {
    loading,
    adminConfig,
    userConfig,
    finalConfig,
    isModuleVisible,
    hasSectionVisibleModules,
    getVisibleModules,
    refreshUserConfig,
  };
};
