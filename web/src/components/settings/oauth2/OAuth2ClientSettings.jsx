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

import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Popconfirm,
  Empty,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { User, Grid3X3 } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import CreateOAuth2ClientModal from './modals/CreateOAuth2ClientModal';
import EditOAuth2ClientModal from './modals/EditOAuth2ClientModal';
import SecretDisplayModal from './modals/SecretDisplayModal';
import ServerInfoModal from './modals/ServerInfoModal';
import JWKSInfoModal from './modals/JWKSInfoModal';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function OAuth2ClientSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');
  const [showServerInfoModal, setShowServerInfoModal] = useState(false);
  const [showJWKSModal, setShowJWKSModal] = useState(false);

  // 加载客户端列表
  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth_clients/');
      if (res.data.success) {
        setClients(res.data.data || []);
        setFilteredClients(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('加载OAuth2客户端失败'));
    } finally {
      setLoading(false);
    }
  };

  // 搜索过滤
  const handleSearch = (value) => {
    setSearchKeyword(value);
    if (!value) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(
        (client) =>
          client.name?.toLowerCase().includes(value.toLowerCase()) ||
          client.id?.toLowerCase().includes(value.toLowerCase()) ||
          client.description?.toLowerCase().includes(value.toLowerCase()),
      );
      setFilteredClients(filtered);
    }
  };

  // 删除客户端
  const handleDelete = async (client) => {
    try {
      const res = await API.delete(`/api/oauth_clients/${client.id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        loadClients();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  // 重新生成密钥
  const handleRegenerateSecret = async (client) => {
    try {
      const res = await API.post(
        `/api/oauth_clients/${client.id}/regenerate_secret`,
      );
      if (res.data.success) {
        setCurrentSecret(res.data.client_secret);
        setShowSecretModal(true);
        loadClients();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('重新生成密钥失败'));
    }
  };

  // 查看服务器信息
  const showServerInfo = () => {
    setShowServerInfoModal(true);
  };

  // 查看JWKS
  const showJWKS = () => {
    setShowJWKSModal(true);
  };

  // 表格列定义
  const columns = [
    {
      title: t('客户端名称'),
      dataIndex: 'name',
      render: (name) => (
        <div className='flex items-center'>
          <User size={16} className='mr-1.5 text-gray-500' />
          <Text strong>{name}</Text>
        </div>
      ),
      width: 150,
    },
    {
      title: t('客户端ID'),
      dataIndex: 'id',
      render: (id) => (
        <Text type='tertiary' size='small' code copyable>
          {id}
        </Text>
      ),
      width: 200,
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      render: (description) => (
        <Text type='tertiary' size='small'>
          {description || '-'}
        </Text>
      ),
      width: 150,
    },
    {
      title: t('类型'),
      dataIndex: 'client_type',
      render: (text) => (
        <Tag
          color={text === 'confidential' ? 'blue' : 'green'}
          style={{ borderRadius: '12px' }}
        >
          {text === 'confidential' ? t('机密客户端') : t('公开客户端')}
        </Tag>
      ),
      width: 120,
    },
    {
      title: t('授权类型'),
      dataIndex: 'grant_types',
      render: (grantTypes) => {
        const types =
          typeof grantTypes === 'string'
            ? grantTypes.split(',')
            : grantTypes || [];
        const typeMap = {
          client_credentials: t('客户端凭证'),
          authorization_code: t('授权码'),
          refresh_token: t('刷新令牌'),
        };
        return (
          <div className='flex flex-wrap gap-1'>
            {types.slice(0, 2).map((type) => (
              <Tag key={type} size='small' style={{ borderRadius: '8px' }}>
                {typeMap[type] || type}
              </Tag>
            ))}
            {types.length > 2 && (
              <Tooltip
                content={types
                  .slice(2)
                  .map((t) => typeMap[t] || t)
                  .join(', ')}
              >
                <Tag size='small' style={{ borderRadius: '8px' }}>
                  +{types.length - 2}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
      width: 150,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (status) => (
        <Tag
          color={status === 1 ? 'green' : 'red'}
          style={{ borderRadius: '12px' }}
        >
          {status === 1 ? t('启用') : t('禁用')}
        </Tag>
      ),
      width: 80,
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (time) => new Date(time * 1000).toLocaleString(),
      width: 150,
    },
    {
      title: t('操作'),
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            theme='borderless'
            type='primary'
            size='small'
            onClick={() => {
              setEditingClient(record);
              setShowEditModal(true);
            }}
            style={{ padding: '4px 8px' }}
          >
            {t('编辑')}
          </Button>
          {record.client_type === 'confidential' && (
            <Popconfirm
              title={t('确认重新生成客户端密钥？')}
              content={
                <div style={{ maxWidth: 280 }}>
                  <div className='mb-2'>
                    <Text strong>{t('客户端')}：</Text>
                    <Text>{record.name}</Text>
                  </div>
                  <div className='p-3 bg-orange-50 border border-orange-200 rounded-md'>
                    <Text size='small' type='warning'>
                      ⚠️ {t('操作不可撤销，旧密钥将立即失效。')}
                    </Text>
                  </div>
                </div>
              }
              onConfirm={() => handleRegenerateSecret(record)}
              okText={t('确认')}
              cancelText={t('取消')}
              position='bottomLeft'
            >
              <Button
                theme='borderless'
                type='secondary'
                size='small'
                style={{ padding: '4px 8px' }}
              >
                {t('重新生成密钥')}
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('请再次确认删除该客户端')}
            content={
              <div style={{ maxWidth: 280 }}>
                <div className='mb-2'>
                  <Text strong>{t('客户端')}：</Text>
                  <Text>{record.name}</Text>
                </div>
                <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
                  <Text size='small' type='danger'>
                    🗑️ {t('删除后无法恢复，相关 API 调用将立即失效。')}
                  </Text>
                </div>
              </div>
            }
            onConfirm={() => handleDelete(record)}
            okText={t('确定删除')}
            cancelText={t('取消')}
            position='bottomLeft'
          >
            <Button
              theme='borderless'
              type='danger'
              size='small'
              style={{ padding: '4px 8px' }}
            >
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
      width: 140,
      fixed: 'right',
    },
  ];

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <Card
      className='!rounded-2xl shadow-sm border-0'
      style={{ marginTop: 10 }}
      title={
        <div
          className='flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3 sm:gap-0'
          style={{ paddingRight: '8px' }}
        >
          <div className='flex items-center'>
            <User size={18} className='mr-2' />
            <Text strong>{t('OAuth2 客户端管理')}</Text>
            <Tag color='white' shape='circle' size='small' className='ml-2'>
              {filteredClients.length} {t('个客户端')}
            </Tag>
          </div>
          <div className='flex items-center gap-2 sm:flex-shrink-0 flex-wrap'>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索客户端名称、ID或描述')}
              value={searchKeyword}
              onChange={handleSearch}
              showClear
              size='small'
              style={{ width: 300 }}
            />
            <Button onClick={loadClients} size='small'>
              {t('刷新')}
            </Button>
            <Button onClick={showServerInfo} size='small'>
              {t('服务器信息')}
            </Button>
            <Button onClick={showJWKS} size='small'>
              {t('查看JWKS')}
            </Button>
            <Button
              type='primary'
              onClick={() => setShowCreateModal(true)}
              size='small'
            >
              {t('创建客户端')}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type='tertiary'>
          {t(
            '管理OAuth2客户端应用程序，每个客户端代表一个可以访问API的应用程序。机密客户端用于服务器端应用，公开客户端用于移动应用或单页应用。',
          )}
        </Text>
      </div>

      {/* 客户端表格 */}
      <Table
        columns={columns}
        dataSource={filteredClients}
        rowKey='id'
        loading={loading}
        scroll={{ x: 1200 }}
        style={{ marginTop: 8 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            t('第 {{start}}-{{end}} 条，共 {{total}} 条', {
              start: range[0],
              end: range[1],
              total,
            }),
          pageSize: 10,
          size: 'small',
          style: { marginTop: 16 },
        }}
        empty={
          <Empty
            image={<User size={48} className='text-gray-400' />}
            title={t('暂无OAuth2客户端')}
            description={
              <div className='text-gray-500 mt-2'>
                {t('还没有创建任何客户端，点击下方按钮创建第一个客户端')}
              </div>
            }
          >
            <Button
              type='primary'
              onClick={() => setShowCreateModal(true)}
              className='mt-4'
            >
              {t('创建第一个客户端')}
            </Button>
          </Empty>
        }
      />

      {/* 创建客户端模态框 */}
      <CreateOAuth2ClientModal
        visible={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadClients();
        }}
      />

      {/* 编辑客户端模态框 */}
      <EditOAuth2ClientModal
        visible={showEditModal}
        client={editingClient}
        onCancel={() => {
          setShowEditModal(false);
          setEditingClient(null);
        }}
        onSuccess={() => {
          setShowEditModal(false);
          setEditingClient(null);
          loadClients();
        }}
      />

      {/* 密钥显示模态框 */}
      <SecretDisplayModal
        visible={showSecretModal}
        onClose={() => setShowSecretModal(false)}
        secret={currentSecret}
      />

      {/* 服务器信息模态框 */}
      <ServerInfoModal
        visible={showServerInfoModal}
        onClose={() => setShowServerInfoModal(false)}
      />

      {/* JWKS信息模态框 */}
      <JWKSInfoModal
        visible={showJWKSModal}
        onClose={() => setShowJWKSModal(false)}
      />
    </Card>
  );
}
