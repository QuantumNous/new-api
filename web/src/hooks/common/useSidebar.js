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

import { useState, useEffect } from 'react';
import { API } from '../../helpers';

// 创建一个全局事件系统来同步所有useSidebar实例
if (!window.sidebarEventTarget) {
  window.sidebarEventTarget = new EventTarget();
}
const sidebarEventTarget = window.sidebarEventTarget;
const SIDEBAR_REFRESH_EVENT = 'sidebar-refresh';

export const useSidebar = () => {
  const [sidebarConfig, setSidebarConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // 默认配置
  const defaultSidebarConfig = {
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
      user: {
        enabled: true,
        groupManagement: true  // 默认启用分组管理
      },
      setting: true
    }
  };

  // 加载侧边栏配置的方法
  const loadSidebarConfig = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/user/self');
      if (res.data.success && res.data.data.sidebar_config) {
        setSidebarConfig(res.data.data.sidebar_config);
      } else {
        // 使用默认配置
        setSidebarConfig(defaultSidebarConfig);
      }
    } catch (error) {
      // 出错时使用默认配置
      setSidebarConfig(defaultSidebarConfig);
    } finally {
      setLoading(false);
    }
  };

  // 刷新侧边栏配置的方法（供外部调用）
  const refreshUserConfig = async () => {
    await loadSidebarConfig();
    // 触发全局刷新事件，通知所有useSidebar实例更新
    sidebarEventTarget.dispatchEvent(new CustomEvent(SIDEBAR_REFRESH_EVENT));
  };

  // 初始加载配置
  useEffect(() => {
    loadSidebarConfig();
  }, []);

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefresh = () => {
      loadSidebarConfig();
    };

    sidebarEventTarget.addEventListener(SIDEBAR_REFRESH_EVENT, handleRefresh);

    return () => {
      sidebarEventTarget.removeEventListener(SIDEBAR_REFRESH_EVENT, handleRefresh);
    };
  }, []);

  // 直接使用后端计算好的最终配置
  const finalConfig = sidebarConfig || {};

  // 检查特定功能是否应该显示
  const isModuleVisible = (sectionKey, moduleKey = null) => {
    if (moduleKey) {
      const moduleValue = finalConfig[sectionKey]?.[moduleKey];
      // 处理布尔值和嵌套对象两种情况
      if (typeof moduleValue === 'boolean') {
        return moduleValue === true;
      } else if (typeof moduleValue === 'object' && moduleValue !== null) {
        // 对于嵌套对象，检查其enabled状态
        return moduleValue.enabled === true;
      }
      return false;
    } else {
      return finalConfig[sectionKey]?.enabled === true;
    }
  };

  // 检查区域是否有任何可见的功能
  const hasSectionVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return false;

    return Object.keys(section).some(key => {
      if (key === 'enabled') return false;

      const moduleValue = section[key];
      // 处理布尔值和嵌套对象两种情况
      if (typeof moduleValue === 'boolean') {
        return moduleValue === true;
      } else if (typeof moduleValue === 'object' && moduleValue !== null) {
        // 对于嵌套对象，检查其enabled状态
        return moduleValue.enabled === true;
      }
      return false;
    });
  };

  // 获取区域的可见功能列表
  const getVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return [];

    return Object.keys(section).filter(key => {
      if (key === 'enabled') return false;

      const moduleValue = section[key];
      // 处理布尔值和嵌套对象两种情况
      if (typeof moduleValue === 'boolean') {
        return moduleValue === true;
      } else if (typeof moduleValue === 'object' && moduleValue !== null) {
        // 对于嵌套对象，检查其enabled状态
        return moduleValue.enabled === true;
      }
      return false;
    });
  };

  return {
    loading,
    sidebarConfig,
    finalConfig,
    isModuleVisible,
    hasSectionVisibleModules,
    getVisibleModules,
    refreshUserConfig,
  };
};
