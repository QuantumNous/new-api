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

import { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import UserGroupManagement from './modals/UserGroupManagement';
import { useSidebar } from '../../../hooks/common/useSidebar';

const UsersActions = ({ setShowAddUser, onRefreshUsers, t }) => {
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const { finalConfig, loading: sidebarLoading } = useSidebar();

  // 检查用户权限
  const getUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || 0;
  };

  const isAdmin = () => getUserRole() >= 10;
  const isRoot = () => getUserRole() >= 100;

  // 检查分组管理功能是否可见
  const canShowGroupManagement = () => {
    // 如果侧边栏配置还在加载中，暂时不显示按钮
    if (sidebarLoading) {
      return false;
    }

    // 超级管理员始终可以看到分组管理按钮
    if (isRoot()) {
      return true;
    }

    // 管理员需要检查系统设置中的分组管理开关
    if (isAdmin()) {
      // 从useSidebar钩子获取最终的权限配置
      const userSection = finalConfig?.admin?.user;

      // 检查用户管理模块是否启用
      if (!userSection || userSection.enabled === false) {
        return false;
      }

      // 检查分组管理子功能是否启用
      return userSection.groupManagement === true;
    }

    // 普通用户无权访问
    return false;
  };

  // Add new user
  const handleAddUser = () => {
    setShowAddUser(true);
  };

  return (
    <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button className='w-full md:w-auto' onClick={handleAddUser} size='small'>
        {t('添加用户')}
      </Button>
    </div>
  );
};

export default UsersActions;
