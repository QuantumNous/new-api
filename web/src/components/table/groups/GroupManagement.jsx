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

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Empty,
  Space,
  Tag,
  Typography,
  Popconfirm,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconRefresh,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardTable from '../../common/ui/CardTable';
import EditGroupModal from './modals/EditGroupModal';

const { Text } = Typography;

const GroupManagement = (props) => {
  const { t } = useTranslation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const {
    groupRatio,
    userUsableGroups,
    loading,
    onSave,
    refresh,
  } = props;

  const [localGroups, setLocalGroups] = useState([]);

  useEffect(() => {
    const groups = [];
    const ratioMap = groupRatio || {};
    const usableMap = userUsableGroups || {};

    const allKeys = new Set([...Object.keys(ratioMap), ...Object.keys(usableMap)]);

    allKeys.forEach((key) => {
      groups.push({
        name: key,
        ratio: ratioMap[key] ?? 1,
        description: usableMap[key] || '',
      });
    });

    setLocalGroups(groups);
  }, [groupRatio, userUsableGroups]);

  const handleAdd = () => {
    setEditingGroup(null);
    setShowEditModal(true);
  };

  const handleEdit = (record) => {
    setEditingGroup(record);
    setShowEditModal(true);
  };

  const handleDelete = (record) => {
    const newGroups = localGroups.filter((g) => g.name !== record.name);
    saveGroups(newGroups);
  };

  const handleSaveGroup = (group) => {
    let newGroups;
    if (editingGroup) {
      newGroups = localGroups.map((g) =>
        g.name === editingGroup.name ? group : g,
      );
    } else {
      if (localGroups.some((g) => g.name === group.name)) {
        return false;
      }
      newGroups = [...localGroups, group];
    }
    saveGroups(newGroups);
    setShowEditModal(false);
    return true;
  };

  const saveGroups = (groups) => {
    const newGroupRatio = {};
    const newUserUsableGroups = {};

    groups.forEach((g) => {
      newGroupRatio[g.name] = g.ratio;
      if (g.description) {
        newUserUsableGroups[g.name] = g.description;
      }
    });

    onSave({
      GroupRatio: JSON.stringify(newGroupRatio, null, 2),
      UserUsableGroups: JSON.stringify(newUserUsableGroups, null, 2),
    });
  };

  const columns = useMemo(() => {
    return [
      {
        title: t('分组名称'),
        dataIndex: 'name',
        key: 'name',
        width: 150,
        render: (text) => (
          <Text strong className="font-mono">
            {text}
          </Text>
        ),
      },
      {
        title: t('分组描述'),
        dataIndex: 'description',
        key: 'description',
        width: 200,
        render: (text) => text || <Text type="tertiary">-</Text>,
      },
      {
        title: t('倍率'),
        dataIndex: 'ratio',
        key: 'ratio',
        width: 100,
        render: (ratio) => (
          <Tag color={ratio < 1 ? 'green' : ratio > 1 ? 'red' : 'grey'}>
            {ratio}x
          </Tag>
        ),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        key: 'operate',
        width: 150,
        fixed: 'right',
        render: (text, record) => (
          <Space>
            <Button
              theme="light"
              type="primary"
              size="small"
              icon={<IconEdit />}
              onClick={() => handleEdit(record)}
            >
              {t('编辑')}
            </Button>
            <Popconfirm
              title={t('确定删除此分组？')}
              content={t('删除后不可恢复')}
              onConfirm={() => handleDelete(record)}
            >
              <Button
                theme="light"
                type="danger"
                size="small"
                icon={<IconDelete />}
              >
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [t, localGroups]);

  return (
    <Card
      className="!rounded-2xl shadow-sm border-0"
      title={
        <div className="flex items-center justify-between">
          <Space>
            <Text className="text-lg font-medium">{t('分组管理')}</Text>
            <Text type="tertiary" size="small">
              {t('共 {{count}} 个分组', { count: localGroups.length })}
            </Text>
          </Space>
          <Space>
            <Button
              theme="light"
              type="tertiary"
              size="small"
              icon={<IconRefresh />}
              onClick={refresh}
            >
              {t('刷新')}
            </Button>
            <Button
              theme="solid"
              type="primary"
              size="small"
              icon={<IconPlus />}
              onClick={handleAdd}
            >
              {t('新增分组')}
            </Button>
          </Space>
        </div>
      }
    >
      <CardTable
        columns={columns}
        dataSource={localGroups}
        scroll={{ x: 'max-content' }}
        pagination={false}
        loading={loading}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无分组数据')}
            style={{ padding: 30 }}
          />
        }
        size="middle"
        rowKey="name"
      />

      <EditGroupModal
        visible={showEditModal}
        onCancel={() => setShowEditModal(false)}
        onSave={handleSaveGroup}
        editingGroup={editingGroup}
        existingNames={localGroups.map((g) => g.name)}
        t={t}
      />
    </Card>
  );
};

export default GroupManagement;
