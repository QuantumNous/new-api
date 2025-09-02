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

import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { StatusContext } from '../../context/Status';
import Loading from '../common/ui/Loading';
import { API } from '../../helpers';

/**
 * ModuleRoute - 基于功能模块权限的路由保护组件
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 要保护的子组件
 * @param {string} props.modulePath - 模块权限路径，如 "admin.channel", "console.token"
 * @param {React.ReactNode} props.fallback - 无权限时显示的组件，默认跳转到 /forbidden
 * @returns {React.ReactNode}
 */
const ModuleRoute = ({ children, modulePath, fallback = <Navigate to="/forbidden" replace /> }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [statusState] = useContext(StatusContext);

  useEffect(() => {
    checkModulePermission();
  }, [modulePath, statusState?.status]); // 只在status数据变化时重新检查

  const checkModulePermission = async () => {
    try {
      // 检查用户是否已登录
      const user = localStorage.getItem('user');
      if (!user) {
        setHasPermission(false);
        return;
      }

      const userData = JSON.parse(user);
      const userRole = userData.role;

      // 超级管理员始终有权限
      if (userRole >= 100) {
        setHasPermission(true);
        return;
      }

      // 检查模块权限
      const permission = await checkModulePermissionAPI(modulePath);

      // 如果返回null，表示status数据还未加载完成，保持loading状态
      if (permission === null) {
        setHasPermission(null);
        return;
      }

      setHasPermission(permission);
    } catch (error) {
      console.error('检查模块权限失败:', error);
      // 出错时采用安全优先策略，拒绝访问
      setHasPermission(false);
    }
  };

  const checkModulePermissionAPI = async (modulePath) => {
    try {
      // 数据看板始终允许访问，不受控制台区域开关影响
      if (modulePath === 'console.detail') {
        return true;
      }

      // 从StatusContext中获取配置信息
      // 如果status数据还未加载完成，返回null表示需要等待
      if (!statusState?.status) {
        return null;
      }

      const user = JSON.parse(localStorage.getItem('user'));
      const userRole = user.role;

      // 解析模块路径
      const pathParts = modulePath.split('.');
      if (pathParts.length < 2) {
        return false;
      }

      // 普通用户权限检查
      if (userRole < 10) {
        return await isUserModuleAllowed(modulePath);
      }

      // 超级管理员权限检查 - 不受系统配置限制
      if (userRole >= 100) {
        return true;
      }

      // 管理员权限检查 - 受系统配置限制
      if (userRole >= 10 && userRole < 100) {
        // 从/api/user/self获取系统权限配置
        try {
          const userRes = await API.get('/api/user/self');
          if (userRes.data.success && userRes.data.data.sidebar_config) {
            const sidebarConfigData = userRes.data.data.sidebar_config;
            // 管理员权限检查基于系统配置，不受用户偏好影响
            const systemConfig = sidebarConfigData.system || sidebarConfigData;
            return checkModulePermissionInConfig(systemConfig, modulePath);
          } else {
            // 没有配置时，除了系统设置外都允许访问
            return modulePath !== 'admin.setting';
          }
        } catch (error) {
          console.error('获取侧边栏配置失败:', error);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('API权限检查失败:', error);
      return false;
    }
  };

  const isUserModuleAllowed = async (modulePath) => {
    // 数据看板始终允许访问，不受控制台区域开关影响
    if (modulePath === 'console.detail') {
      return true;
    }

    // 普通用户的权限基于最终计算的配置
    try {
      const userRes = await API.get('/api/user/self');
      if (userRes.data.success && userRes.data.data.sidebar_config) {
        const sidebarConfigData = userRes.data.data.sidebar_config;
        // 使用最终计算的配置进行权限检查
        const finalConfig = sidebarConfigData.final || sidebarConfigData;
        return checkModulePermissionInConfig(finalConfig, modulePath);
      }
      return false;
    } catch (error) {
      console.error('获取用户权限配置失败:', error);
      return false;
    }
  };

  // 检查新的sidebar_config结构中的模块权限
  const checkModulePermissionInConfig = (sidebarConfig, modulePath) => {
    const parts = modulePath.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [sectionKey, moduleKey] = parts;
    const section = sidebarConfig[sectionKey];

    // 检查区域是否存在且启用
    if (!section || !section.enabled) {
      return false;
    }

    // 检查模块是否启用
    const moduleValue = section[moduleKey];
    // 处理布尔值和嵌套对象两种情况
    if (typeof moduleValue === 'boolean') {
      return moduleValue === true;
    } else if (typeof moduleValue === 'object' && moduleValue !== null) {
      // 对于嵌套对象，检查其enabled状态
      return moduleValue.enabled === true;
    }
    return false;
  };

  // 权限检查中
  if (hasPermission === null) {
    return <Loading />;
  }

  // 无权限
  if (!hasPermission) {
    return fallback;
  }

  // 有权限，渲染子组件
  return children;
};

export default ModuleRoute;
