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

import React, { useState, useEffect } from 'react';
import {
  SideSheet,
  Button,
  Typography,
  Space,
  Tag,
  Popconfirm,
  Card,
  Avatar,
  Spin,
  Empty,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconLayers,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError, showSuccess, stringToColor } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import CardTable from '../../../common/ui/CardTable';
import EditPrefillGroupModal from './EditPrefillGroupModal';
import { renderLimitedItems, renderDescription } from '../../../common/ui/RenderUtils';

const { Text, Title } = Typography;

const PrefillGroupManagement = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editingGroup, setEditingGroup] = useState({ id: undefined });

  const typeOptions = [
    { label: t('模型组'), value: 'model' },
    { label: t('标签组'), value: 'tag' },
    { label: t('端点组'), value: 'endpoint' },
  ];

  // 加载组列表
  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/prefill_group');
      if (res.data.success) {
        setGroups(res.data.data || []);
      } else {
        showError(res.data.message || t('获取组列表失败'));
      }
    } catch (error) {
      showError(t('获取组列表失败'));
    }
    setLoading(false);
  };

  // 删除组
  const deleteGroup = async (id) => {
    try {
      const res = await API.delete(`/api/prefill_group/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        loadGroups();
      } else {
        showError(res.data.message || t('删除失败'));
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  // 编辑组
  const handleEdit = (group = {}) => {
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
  };

  // 表格列定义
  const columns = [
    {
      title: t('组名'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag color="white" shape="circle" size="small">
            {typeOptions.find(opt => opt.value === record.type)?.label || record.type}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
      render: (text) => renderDescription(text, 150),
    },
    {
      title: t('项目内容'),
      dataIndex: 'items',
      key: 'items',
      render: (items, record) => {
        try {
          if (record.type === 'endpoint') {
            const obj = typeof items === 'string' ? JSON.parse(items || '{}') : (items || {});
            const keys = Object.keys(obj);
            if (keys.length === 0) return <Text type="tertiary">{t('暂无项目')}</Text>;
            return renderLimitedItems({
              items: keys,
              renderItem: (key, idx) => (
                <Tag key={idx} size="small" shape='circle' color={stringToColor(key)}>
                  {key}
                </Tag>
              ),
              maxDisplay: 3,
            });
          }
          const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
          if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
            return <Text type="tertiary">{t('暂无项目')}</Text>;
          }
          return renderLimitedItems({
            items: itemsArray,
            renderItem: (item, idx) => (
              <Tag key={idx} size="small" shape='circle' color={stringToColor(item)}>
                {item}
              </Tag>
            ),
            maxDisplay: 3,
          });
        } catch {
          return <Text type="tertiary">{t('数据格式错误')}</Text>;
        }
      },
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => handleEdit(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确定删除此组？')}
            onConfirm={() => deleteGroup(record.id)}
          >
            <Button
              size="small"
              type="danger"
            >
              {t('删除')}
            </Button>
          </Popconfirm>
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
        placement="left"
        title={
          <Space>
            <Tag color='blue' shape='circle'>
              {t('管理')}
            </Tag>
            <Title heading={4} className='m-0'>
              {t('预填组管理')}
            </Title>
          </Space>
        }
        visible={visible}
        onCancel={onClose}
        width={isMobile ? '100%' : 800}
        bodyStyle={{ padding: '0' }}
        closeIcon={null}
      >
        <Spin spinning={loading}>
          <div className='p-2'>
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-2'>
                <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                  <IconLayers size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('组列表')}</Text>
                  <div className='text-xs text-gray-600'>{t('管理模型、标签、端点等预填组')}</div>
                </div>
              </div>
              <div className="flex justify-end mb-4">
                <Button
                  type="primary"
                  theme='solid'
                  size="small"
                  icon={<IconPlus />}
                  onClick={() => handleEdit()}
                >
                  {t('新建组')}
                </Button>
              </div>
              {groups.length > 0 ? (
                <CardTable
                  columns={columns}
                  dataSource={groups}
                  rowKey="id"
                  hidePagination={true}
                  size="small"
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <Empty
                  image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                  darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                  description={t('暂无预填组')}
                  style={{ padding: 30 }}
                />
              )}
            </Card>
          </div>
        </Spin>
      </SideSheet>

      {/* 编辑组件 */}
      <EditPrefillGroupModal
        visible={showEdit}
        onClose={closeEdit}
        editingGroup={editingGroup}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export default PrefillGroupManagement;