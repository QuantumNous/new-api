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

import { useState, useContext } from 'react';
import { Button } from '@douyinfe/semi-ui';
import UserGroupManagement from './modals/UserGroupManagement';
import { StatusContext } from '../../../context/Status';

const UsersActions = ({ setShowAddUser, onRefreshUsers, t }) => {
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [statusState] = useContext(StatusContext);

  // 检查用户权限
  const getUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || 0;
  };

  const isAdmin = () => getUserRole() >= 10;
  const isRoot = () => getUserRole() >= 100;

  // 检查分组管理功能是否可见
  const canShowGroupManagement = () => {
    // 超级管理员始终可以看到分组管理按钮
    if (isRoot()) {
      return true;
    }

    // 管理员需要检查系统设置中的分组管理开关
    if (isAdmin()) {
      // 从StatusContext中获取侧边栏管理员配置
      if (statusState?.status?.SidebarModulesAdmin) {
        try {
          const config = JSON.parse(statusState.status.SidebarModulesAdmin);
          const userModuleConfig = config?.admin?.user;

          // 检查用户管理模块是否启用
          if (!userModuleConfig || !userModuleConfig.enabled) {
            return false;
          }

          // 检查分组管理子功能是否启用
          return userModuleConfig.groupManagement === true;
        } catch (error) {
          console.error('解析侧边栏配置失败:', error);
          return true; // 解析失败时默认允许访问
        }
      }
      return true; // 没有配置时默认允许访问
    }

    // 普通用户无权访问
    return false;
  };

  // Add new user
  const handleAddUser = () => {
    setShowAddUser(true);
  };

  // Show group management
  const handleGroupManagement = () => {
    setShowGroupManagement(true);
  };

  return (
    <>
      <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button className='w-full md:w-auto' onClick={handleAddUser} size='small'>
          {t('添加用户')}
        </Button>
        {canShowGroupManagement() && (
          <Button
            className='w-full md:w-auto'
            onClick={handleGroupManagement}
            size='small'
            theme='light'
          >
            {t('分组管理')}
          </Button>
        )}
      </div>

      {canShowGroupManagement() && (
        <UserGroupManagement
          visible={showGroupManagement}
          onClose={() => setShowGroupManagement(false)}
          onGroupUpdated={onRefreshUsers}
        />
      )}
    </>
  );
};

export default UsersActions;
