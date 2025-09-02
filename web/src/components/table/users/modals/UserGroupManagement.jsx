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
+*/

import React, { useState, useEffect } from 'react';
import {
  SideSheet,
  Button,
  Space,
  Card,
  Avatar,
  Typography,
  Spin,
  Empty,
  Popconfirm,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconUserGroup,
  IconPlus,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { API, showError, showSuccess } from '../../../../helpers';
import CardTable from '../../../common/ui/CardTable';
import EditUserGroupModal from './EditUserGroupModal';
import { useSidebar } from '../../../../hooks/common/useSidebar';

const UserGroupManagement = ({ visible, onClose, onGroupUpdated }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editingGroup, setEditingGroup] = useState({ id: undefined });
  const { finalConfig, loading: sidebarLoading } = useSidebar();

  // 检查用户权限
  const getUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || 0;
  };

  const isRoot = () => getUserRole() >= 100;
  const isAdmin = () => getUserRole() >= 10;

  // 检查是否有分组管理权限
  const hasGroupManagementPermission = () => {
    // 如果侧边栏配置还在加载中，暂时拒绝访问
    if (sidebarLoading) {
      return false;
    }

    // 超级管理员始终有权限
    if (isRoot()) {
      return true;
    }

    // 管理员需要检查权限配置
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

  // 加载分组列表
  const loadGroups = async () => {
    // 检查权限
    if (!hasGroupManagementPermission()) {
      showError(t('无权访问分组管理功能'));
      onClose();
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/api/user_group');
      if (res.data.success) {
        setGroups(res.data.data || []);
      } else {
        showError(res.data.message || t('获取分组列表失败'));
        // 如果是权限错误，关闭模态框
        if (res.status === 403) {
          onClose();
        }
      }
    } catch (error) {
      showError(t('获取分组列表失败'));
      // 如果是权限错误，关闭模态框
      if (error.response?.status === 403) {
        onClose();
      }
    }
    setLoading(false);
  };

  // 删除分组
  const deleteGroup = async (id) => {
    // 检查权限
    if (!hasGroupManagementPermission()) {
      showError(t('无权访问分组管理功能'));
      return;
    }

    try {
      const res = await API.delete(`/api/user_group/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        loadGroups();
      } else {
        showError(res.data.message || t('删除失败'));
      }
    } catch (error) {
      if (error.response?.status === 403) {
        showError(t('无权访问分组管理功能'));
        onClose();
      } else {
        showError(t('删除失败'));
      }
    }
  };

  // 编辑分组
  const handleEdit = (group = {}) => {
    // 检查权限
    if (!hasGroupManagementPermission()) {
      showError(t('无权访问分组管理功能'));
      return;
    }

    setEditingGroup(group);
    setShowEdit(true);
  };

  // 关闭编辑
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingGroup({ id: undefined });
    }, 300);
  };

  // 编辑成功回调
  const handleEditSuccess = () => {
    closeEdit();
    loadGroups();
    // 通知父组件刷新用户数据
    if (onGroupUpdated) {
      onGroupUpdated();
    }
  };

  // 获取分组显示名称
  const getGroupDisplayName = (groupName) => {
    if (groupName === 'default') {
      return t('默认');
    }
    return groupName;
  };

  // 获取分组描述的翻译
  const getGroupDescription = (groupName, originalDescription) => {
    // 对于系统默认分组，使用翻译
    if (groupName === 'default' && originalDescription === '默认分组') {
      return t('默认分组');
    }
    if (groupName === 'vip' && originalDescription === 'VIP分组') {
      return t('VIP分组');
    }
    if (groupName === 'svip' && originalDescription === 'SVIP分组') {
      return t('SVIP分组');
    }
    // 对于用户自定义分组，使用原始描述
    return originalDescription;
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: t('分组名称'),
      dataIndex: 'name',
      render: (text, record) => (
        <div className='flex items-center gap-2'>
          <Tag
            color={record.name === 'default' ? 'blue' :
                   record.name === 'vip' ? 'orange' :
                   record.name === 'svip' ? 'red' : 'green'}
            shape='circle'
          >
            {getGroupDisplayName(text)}
          </Tag>
          {(record.name === 'default' || record.name === 'vip' || record.name === 'svip') && (
            <Tag size='small' color='grey'>
              {t('系统默认')}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: t('分组描述'),
      dataIndex: 'description',
      render: (text, record) => {
        const translatedDescription = getGroupDescription(record.name, text);
        return translatedDescription || <Typography.Text type='tertiary'>{t('无描述')}</Typography.Text>;
      },
    },
    {
      title: t('分组倍率'),
      dataIndex: 'ratio',
      width: 100,
      render: (text) => (
        <Tag color='cyan' shape='circle'>
          {text}
        </Tag>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 150,
      render: (text) => new Date(text * 1000).toLocaleString(),
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size='small' onClick={() => handleEdit(record)}>
            {t('编辑')}
          </Button>
          {record.name !== 'default' && record.name !== 'vip' && record.name !== 'svip' && (
            <Popconfirm
              title={t('确定删除此分组？')}
              content={t('删除后无法恢复，请确认该分组未被用户使用')}
              onConfirm={() => deleteGroup(record.id)}
            >
              <Button size='small' type='danger'>
                {t('删除')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    if (visible) {
      loadGroups();
    }
  }, [visible]);

  return (
    <>
      <SideSheet
        title={
          <Space>
            <Avatar size='small' color='blue' className='shadow-md'>
              <IconUserGroup size={16} />
            </Avatar>
            <Typography.Text className='text-lg font-medium'>{t('用户分组管理')}</Typography.Text>
          </Space>
        }
        visible={visible}
        onCancel={onClose}
        width={isMobile ? '100%' : 1000}
        bodyStyle={{ padding: '0' }}
        closeIcon={null}
      >
        <Spin spinning={loading}>
          <div className='p-2'>
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-2'>
                <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                  <IconUserGroup size={16} />
                </Avatar>
                <div>
                  <Typography.Text className='text-lg font-medium'>{t('分组列表')}</Typography.Text>
                  <div className='text-xs text-gray-600'>
                    {t('管理用户分组，设置分组倍率')}
                  </div>
                </div>
              </div>
              <div className='flex justify-end mb-4'>
                <Button
                  type='primary'
                  theme='solid'
                  size='small'
                  icon={<IconPlus />}
                  onClick={() => handleEdit()}
                >
                  {t('新建分组')}
                </Button>
              </div>
              {groups.length > 0 ? (
                <CardTable
                  columns={columns}
                  dataSource={groups}
                  rowKey='id'
                  hidePagination={true}
                  size='small'
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 150, height: 150 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 150, height: 150 }}
                    />
                  }
                  description={t('暂无用户分组')}
                  style={{ padding: 30 }}
                />
              )}
            </Card>
          </div>
        </Spin>
      </SideSheet>

      {/* 编辑组件 */}
      <EditUserGroupModal
        visible={showEdit}
        onClose={closeEdit}
        editingGroup={editingGroup}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export default UserGroupManagement;
