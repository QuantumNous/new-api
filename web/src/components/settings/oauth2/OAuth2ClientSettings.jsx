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
  Modal,
  Banner,
  Row,
  Col,
  Empty,
  Tooltip
} from '@douyinfe/semi-ui';
import { 
  Search, 
  Plus, 
  RefreshCw,
  Edit,
  Key,
  Trash2,
  Eye,
  User,
  Grid3X3
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import CreateOAuth2ClientModal from './modals/CreateOAuth2ClientModal';
import EditOAuth2ClientModal from './modals/EditOAuth2ClientModal';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

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
      const filtered = clients.filter(client =>
        client.name?.toLowerCase().includes(value.toLowerCase()) ||
        client.id?.toLowerCase().includes(value.toLowerCase()) ||
        client.description?.toLowerCase().includes(value.toLowerCase())
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
      const res = await API.post(`/api/oauth_clients/${client.id}/regenerate_secret`);
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

  // 快速查看服务器信息
  const showServerInfo = async () => {
    try {
      const res = await API.get('/api/oauth/server-info');
      Modal.info({
        title: t('OAuth2 服务器信息'),
        content: (
          <div>
            <Text>{t('授权服务器配置')}:</Text>
            <pre style={{ 
              background: '#f8f9fa', 
              padding: '12px', 
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '12px',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {JSON.stringify(res.data, null, 2)}
            </pre>
          </div>
        ),
        width: 600
      });
    } catch (error) {
      showError(t('获取服务器信息失败'));
    }
  };

  // 查看JWKS
  const showJWKS = async () => {
    try {
      const res = await API.get('/api/oauth/jwks');
      Modal.info({
        title: t('JWKS 信息'),
        content: (
          <div>
            <Text>{t('JSON Web Key Set')}:</Text>
            <pre style={{ 
              background: '#f8f9fa', 
              padding: '12px', 
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '12px',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {JSON.stringify(res.data, null, 2)}
            </pre>
          </div>
        ),
        width: 600
      });
    } catch (error) {
      showError(t('获取JWKS失败'));
    }
  };

  // 表格列定义
  const columns = [
    {
      title: t('客户端信息'),
      key: 'info',
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <User size={16} style={{ marginRight: 6, color: 'var(--semi-color-text-2)' }} />
            <Text strong>{record.name}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Grid3X3 size={16} style={{ marginRight: 6, color: 'var(--semi-color-text-2)' }} />
            <Text type="tertiary" size="small" code copyable>
              {record.id}
            </Text>
          </div>
        </div>
      ),
      width: 200,
    },
    {
      title: t('类型'),
      dataIndex: 'client_type',
      key: 'client_type',
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
      key: 'grant_types',
      render: (grantTypes) => {
        const types = typeof grantTypes === 'string' ? grantTypes.split(',') : (grantTypes || []);
        const typeMap = {
          'client_credentials': t('客户端凭证'),
          'authorization_code': t('授权码'),
          'refresh_token': t('刷新令牌')
        };
        return (
          <div>
            {types.slice(0, 2).map(type => (
              <Tag key={type} size="small" style={{ margin: '1px', borderRadius: '8px' }}>
                {typeMap[type] || type}
              </Tag>
            ))}
            {types.length > 2 && (
              <Tooltip content={types.slice(2).map(t => typeMap[t] || t).join(', ')}>
                <Tag size="small" style={{ margin: '1px', borderRadius: '8px' }}>
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
      key: 'status',
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
      key: 'created_time',
      render: (time) => new Date(time * 1000).toLocaleString(),
      width: 150,
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Tooltip content={t('编辑客户端')}>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Edit size={14} />}
              onClick={() => {
                setEditingClient(record);
                setShowEditModal(true);
              }}
            />
          </Tooltip>
          {record.client_type === 'confidential' && (
            <Popconfirm
              title={t('确认重新生成客户端密钥？')}
              content={
                <div>
                  <div>{t('客户端')}：{record.name}</div>
                  <div style={{ marginTop: 6, color: 'var(--semi-color-warning)' }}>
                    ⚠️ {t('操作不可撤销，旧密钥将立即失效。')}
                  </div>
                </div>
              }
              onConfirm={() => handleRegenerateSecret(record)}
              okText={t('确认')}
              cancelText={t('取消')}
            >
              <Tooltip content={t('重新生成密钥')}>
                <Button
                  theme="borderless"
                  type="secondary"
                  size="small"
                  icon={<Key size={14} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('请再次确认删除该客户端')}
            content={
              <div>
                <div>{t('客户端')}：{record.name}</div>
                <div style={{ marginTop: 6, color: 'var(--semi-color-danger)' }}>
                  🗑️ {t('删除后无法恢复，相关 API 调用将立即失效。')}
                </div>
              </div>
            }
            onConfirm={() => handleDelete(record)}
            okText={t('确定删除')}
            cancelText={t('取消')}
          >
            <Tooltip content={t('删除客户端')}>
              <Button
                theme="borderless"
                type="danger"
                size="small"
                icon={<Trash2 size={14} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
      width: 120,
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
        <div className='flex items-center'>
          <User size={18} className='mr-2' />
          <Text strong>{t('OAuth2 客户端管理')}</Text>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="tertiary">
          {t('管理OAuth2客户端应用程序，每个客户端代表一个可以访问API的应用程序。机密客户端用于服务器端应用，公开客户端用于移动应用或单页应用。')}
        </Text>
      </div>
      
      {/* 工具栏 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={24} md={10} lg={8}>
          <Input
            prefix={<Search size={16} />}
            placeholder={t('搜索客户端名称、ID或描述')}
            value={searchKeyword}
            onChange={handleSearch}
            showClear
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} sm={24} md={14} lg={16}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Button 
              icon={<RefreshCw size={16} />} 
              onClick={loadClients}
              size="default"
            >
              <span className="hidden sm:inline">{t('刷新')}</span>
            </Button>
            <Button 
              icon={<Eye size={16} />} 
              onClick={showServerInfo}
              size="default"
            >
              <span className="hidden sm:inline">{t('服务器信息')}</span>
            </Button>
            <Button 
              icon={<Key size={16} />} 
              onClick={showJWKS}
              size="default"
            >
              <span className="hidden md:inline">{t('查看JWKS')}</span>
            </Button>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setShowCreateModal(true)}
              size="default"
            >
              {t('创建客户端')}
            </Button>
          </div>
        </Col>
      </Row>

      {/* 客户端表格 */}
      <Table
        columns={columns}
        dataSource={filteredClients}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => t('第 {{start}}-{{end}} 条，共 {{total}} 条', { start: range[0], end: range[1], total }),
          pageSize: 10,
          size: 'small'
        }}
        scroll={{ x: 800 }}
        empty={
          <Empty
            image={<User size={48} />}
            title={t('暂无OAuth2客户端')}
            description={t('还没有创建任何客户端，点击下方按钮创建第一个客户端')}
          >
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setShowCreateModal(true)}
              style={{ marginTop: 16 }}
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
      <Modal
        title={t('客户端密钥已重新生成')}
        visible={showSecretModal}
        onCancel={() => setShowSecretModal(false)}
        onOk={() => setShowSecretModal(false)}
        cancelText=""
        okText={t('我已复制保存')}
        width={600}
      >
        <div>
          <Banner
            type="warning"
            description={t('新的客户端密钥如下，请立即复制保存。关闭此窗口后将无法再次查看。')}
            style={{ marginBottom: 16 }}
          />
          <div style={{ 
            background: '#f8f9fa', 
            padding: '16px', 
            borderRadius: '6px',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            border: '1px solid var(--semi-color-border)'
          }}>
            <Text code copyable style={{ fontSize: '14px' }}>
              {currentSecret}
            </Text>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
