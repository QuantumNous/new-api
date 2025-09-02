import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { StatusContext } from '../../context/Status';
import Loading from '../common/ui/Loading';
import { useSidebar } from '../../hooks/common/useSidebar';
import { USER_ROLES } from '../../constants/user.constants';

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

  // 复用 useSidebar 钩子的配置数据，避免重复 API 调用
  const { loading: sidebarLoading, finalConfig } = useSidebar();

  // 获取用户信息的辅助函数
  const getUserFromStorage = () => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkPermission = async () => {
      const userObj = getUserFromStorage();
      const permission = await checkModulePermission(userObj);

      if (!cancelled) {
        setHasPermission(permission);
      }
    };

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [modulePath, statusState?.status, sidebarLoading, finalConfig]); // 依赖 sidebar 配置变化

  const checkModulePermission = async (userObj) => {
    try {
      // 检查用户是否已登录
      if (!userObj) {
        return false;
      }

      const userRole = userObj.role;

      // 使用精确角色匹配，避免范围检查导致的漂移
      if (userRole === USER_ROLES.ROOT) {
        return true; // 超级管理员始终有权限
      }

      // 如果 sidebar 配置还在加载中，返回 null 表示需要等待
      if (sidebarLoading || !finalConfig) {
        return null;
      }

      // 检查模块权限
      return checkModulePermissionInConfig(userRole, modulePath);
    } catch (error) {
      console.error('检查模块权限失败:', error);
      // 出错时采用安全优先策略，拒绝访问
      return false;
    }
  };

  const checkModulePermissionInConfig = (userRole, modulePath) => {
    // 数据看板始终允许访问，不受控制台区域开关影响
    if (modulePath === 'console.detail') {
      return true;
    }

    // 解析模块路径
    const pathParts = modulePath.split('.');
    if (pathParts.length < 2) {
      console.warn(`无效的模块路径: ${modulePath}`);
      return false;
    }

    // 使用精确角色匹配进行权限检查
    if (userRole === USER_ROLES.COMMON) {
      // 普通用户：使用最终计算的配置进行权限检查
      return checkModuleInSidebarConfig(finalConfig, modulePath);
    } else if (userRole === USER_ROLES.ADMIN) {
      // 管理员：不能访问系统设置，其他基于配置检查
      if (modulePath === 'admin.setting') {
        return false;
      }
      return checkModuleInSidebarConfig(finalConfig, modulePath);
    } else if (userRole === USER_ROLES.ROOT) {
      // 超级管理员：始终有权限
      return true;
    }

    // 未知角色，拒绝访问
    return false;
  };

  // 检查sidebar_config结构中的模块权限
  const checkModuleInSidebarConfig = (sidebarConfig, modulePath) => {
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