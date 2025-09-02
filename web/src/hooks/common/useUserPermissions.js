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

/**
 * 用户权限钩子 - 从后端获取用户权限，替代前端角色判断
 * 确保权限控制的安全性，防止前端绕过
 */
export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 加载用户权限（从用户信息接口获取）
  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get('/api/user/self');
      if (res.data.success) {
        const userPermissions = res.data.data.permissions;
        setPermissions(userPermissions);
        console.log('用户权限加载成功:', userPermissions);
      } else {
        setError(res.data.message || '获取权限失败');
        console.error('获取权限失败:', res.data.message);
      }
    } catch (error) {
      setError('网络错误，请重试');
      console.error('加载用户权限异常:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  // 检查是否有边栏设置权限
  const hasSidebarSettingsPermission = () => {
    return permissions?.sidebar_settings === true;
  };

  // 检查是否允许访问特定的边栏区域
  const isSidebarSectionAllowed = (sectionKey) => {
    if (!permissions?.sidebar_modules) return true;
    const sectionPerms = permissions.sidebar_modules[sectionKey];
    return sectionPerms !== false;
  };

  // 检查是否允许访问特定的边栏模块
  const isSidebarModuleAllowed = (sectionKey, moduleKey) => {
    if (!permissions?.sidebar_modules) return true;
    const sectionPerms = permissions.sidebar_modules[sectionKey];

    // 如果整个区域被禁用
    if (sectionPerms === false) return false;

    // 如果区域存在但模块被禁用
    if (sectionPerms && sectionPerms[moduleKey] === false) return false;

    return true;
  };

  // 获取允许的边栏区域列表
  const getAllowedSidebarSections = () => {
    if (!permissions?.sidebar_modules) return [];

    return Object.keys(permissions.sidebar_modules).filter((sectionKey) =>
      isSidebarSectionAllowed(sectionKey),
    );
  };

  // 获取特定区域允许的模块列表
  const getAllowedSidebarModules = (sectionKey) => {
    if (!permissions?.sidebar_modules) return [];
    const sectionPerms = permissions.sidebar_modules[sectionKey];

    if (sectionPerms === false) return [];
    if (!sectionPerms || typeof sectionPerms !== 'object') return [];

    return Object.keys(sectionPerms).filter(
      (moduleKey) =>
        moduleKey !== 'enabled' && sectionPerms[moduleKey] === true,
    );
  };

  return {
    permissions,
    loading,
    error,
    loadPermissions,
    hasSidebarSettingsPermission,
    isSidebarSectionAllowed,
    isSidebarModuleAllowed,
    getAllowedSidebarSections,
    getAllowedSidebarModules,
  };
};

export default useUserPermissions;
