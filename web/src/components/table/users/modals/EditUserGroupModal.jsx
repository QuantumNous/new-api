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
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  Form,
  Button,
  Space,
  Spin,
  Avatar,
  Typography,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../../helpers';
import { useSidebar } from '../../../../hooks/common/useSidebar';

const EditUserGroupModal = ({ visible, onClose, editingGroup, onSuccess }) => {
  const { t } = useTranslation();
  const formApiRef = useRef(null);
  const [loading, setLoading] = useState(false);
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

  const isEdit = editingGroup && editingGroup.id;
  const isSystemGroup = editingGroup && (
    editingGroup.name === 'default' ||
    editingGroup.name === 'vip' ||
    editingGroup.name === 'svip'
  );

  // 获取分组显示名称
  const getGroupDisplayName = (groupName) => {
    if (groupName === 'default') {
      return t('默认');
    }
    return groupName;
  };

  const getInitValues = () => ({
    name: editingGroup?.name || '',
    description: editingGroup?.description || '',
    ratio: editingGroup?.ratio ?? 1.0,
  });

  const submit = async (values) => {
    // 检查权限
    if (!hasGroupManagementPermission()) {
      showError(t('无权访问分组管理功能'));
      onClose();
      return;
    }

    setLoading(true);
    try {
      const ratioNum =
        typeof values.ratio === 'number' ? values.ratio : parseFloat(values.ratio);
      const data = {
        ...values,
        ratio: Number.isFinite(ratioNum) ? ratioNum : 1.0,
    };

      if (isEdit) {
        data.id = editingGroup.id;
      }

      const url = isEdit ? '/api/user_group' : '/api/user_group';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await API[method.toLowerCase()](url, data);
      const { success, message } = res.data;

      if (success) {
        showSuccess(isEdit ? t('分组更新成功！') : t('分组创建成功！'));
        onSuccess();
      } else {
        showError(message);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        showError(t('无权访问分组管理功能'));
        onClose();
      } else {
        showError(isEdit ? t('分组更新失败') : t('分组创建失败'));
      }
    }
    setLoading(false);
  };

  const handleCancel = () => {
    onClose();
  };

  // 重置表单当编辑分组改变时
  useEffect(() => {
    if (visible && formApiRef.current) {
      formApiRef.current.setValues(getInitValues());
    }
  }, [visible, editingGroup]);

  return (
    <Modal
      title={
        <Space>
          <Avatar size='small' color={isEdit ? 'orange' : 'green'} className='shadow-md'>
            <IconUserGroup size={16} />
          </Avatar>
          <Typography.Text className='text-lg font-medium'>
            {isEdit ? t('编辑分组') : t('新建分组')}
          </Typography.Text>
          {isEdit && (
            <Tag color='blue' shape='circle'>
              {getGroupDisplayName(editingGroup.name)}
            </Tag>
          )}
        </Space>
      }
      visible={visible}
      onCancel={handleCancel}
      width={500}
      footer={
        <div className='flex justify-end'>
          <Space>
            <Button
              theme='solid'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<IconSave />}
              loading={loading}
            >
              {t('保存')}
            </Button>
            <Button
              theme='light'
              type='primary'
              onClick={handleCancel}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
    >
      <Spin spinning={loading}>
        <Form
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
          onSubmitFail={(errs) => {
            const first = Object.values(errs)[0];
            if (first) showError(Array.isArray(first) ? first[0] : first);
            formApiRef.current?.scrollToError();
          }}
        >
          <div className='p-4'>
            <Form.Input
              field='name'
              label={t('分组名称')}
              placeholder={t('请输入分组名称')}
              disabled={isSystemGroup}
              rules={[
                { required: true, message: t('分组名称不能为空') },
                { max: 64, message: t('分组名称不能超过64个字符') },
                {
                  pattern: /^[a-zA-Z0-9_-]+$/,
                  message: t('分组名称只能包含字母、数字、下划线和连字符'),
                },
              ]}
              extraText={
                isSystemGroup 
                  ? t('系统默认分组，名称不可修改')
                  : t('分组名称只能包含字母、数字、下划线和连字符')
              }
            />

            <Form.TextArea
              field='description'
              label={t('分组描述')}
              placeholder={t('请输入分组描述（可选）')}
              maxCount={255}
              autosize={{ minRows: 2, maxRows: 4 }}
              extraText={t('分组的详细描述，用于说明分组用途')}
            />

            <Form.InputNumber
              field='ratio'
              label={t('分组倍率')}
              placeholder={t('请输入分组倍率')}
              min={0}
              max={999}
              step={0.1}
              precision={2}
              rules={[
                { required: true, message: t('分组倍率不能为空') },
                { type: 'number', min: 0, message: t('分组倍率不能小于0') },
              ]}
              extraText={t('分组的计费倍率，影响该分组用户的费用计算')}
              suffix={t('倍')}
            />

            {isSystemGroup && (
              <div className='mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200'>
                <Typography.Text type='tertiary' size='small'>
                  <strong>{t('提示：')}</strong>
                  {t('这是系统默认分组，只能修改描述和倍率，不能修改名称或删除。')}
                </Typography.Text>
              </div>
            )}
          </div>
        </Form>
      </Spin>
    </Modal>
  );
};

export default EditUserGroupModal;
