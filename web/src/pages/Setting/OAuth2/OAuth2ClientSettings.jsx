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
  Form,
  Banner,
  Row,
  Col
} from '@douyinfe/semi-ui';
import { IconSearch, IconPlus } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showInfo } from '../../../helpers';
import CreateOAuth2ClientModal from '../../../components/modals/oauth2/CreateOAuth2ClientModal';
import EditOAuth2ClientModal from '../../../components/modals/oauth2/EditOAuth2ClientModal';
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
      showError('加载OAuth2客户端失败');
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
        showSuccess('删除成功');
        loadClients();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('删除失败');
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
      showError('重新生成密钥失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '客户端名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="tertiary" size="small">{record.id}</Text>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'client_type',
      key: 'client_type',
      render: (text) => (
        <Tag color={text === 'confidential' ? 'blue' : 'green'}>
          {text === 'confidential' ? '机密客户端' : '公开客户端'}
        </Tag>
      ),
    },
    {
      title: '授权类型',
      dataIndex: 'grant_types',
      key: 'grant_types',
      render: (grantTypes) => {
        const types = typeof grantTypes === 'string' ? grantTypes.split(',') : (grantTypes || []);
        return (
          <div>
            {types.map(type => (
              <Tag key={type} size="small" style={{ margin: '2px' }}>
                {type === 'client_credentials' ? '客户端凭证' :
                 type === 'authorization_code' ? '授权码' :
                 type === 'refresh_token' ? '刷新令牌' : type}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_time',
      key: 'created_time',
      render: (time) => new Date(time * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => {
              setEditingClient(record);
              setShowEditModal(true);
            }}
          >
            编辑
          </Button>
          {record.client_type === 'confidential' && (
            <Button
              theme="borderless"
              type="secondary"
              size="small"
              onClick={() => handleRegenerateSecret(record)}
            >
              重新生成密钥
            </Button>
          )}
          <Popconfirm
            title="确定删除这个OAuth2客户端吗？"
            content="删除后无法恢复，相关的API访问将失效。"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              theme="borderless"
              type="danger"
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <div>
      <Card style={{ marginTop: 10 }}>
        <Form.Section text={'OAuth2 客户端管理'}>
        <Banner
          type="info"
          description="管理OAuth2客户端应用程序，每个客户端代表一个可以访问API的应用程序。机密客户端用于服务器端应用，公开客户端用于移动应用或单页应用。"
          style={{ marginBottom: 15 }}
        />
        
        <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={24} md={12} lg={8} xl={8}>
            <Input
              prefix={<IconSearch />}
              placeholder="搜索客户端名称、ID或描述"
              value={searchKeyword}
              onChange={handleSearch}
              showClear
            />
          </Col>
          <Col xs={24} sm={24} md={12} lg={16} xl={16} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={loadClients}>刷新</Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={() => setShowCreateModal(true)}
            >
              创建OAuth2客户端
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredClients}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            pageSize: 10,
          }}
          empty={
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Text type="tertiary">暂无OAuth2客户端</Text>
              <br />
              <Button
                type="primary"
                icon={<IconPlus />}
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: 10 }}
              >
                创建第一个客户端
              </Button>
            </div>
          }
        />

        {/* 快速操作 */}
        <div style={{ marginTop: 20, marginBottom: 10 }}>
          <Text strong>快速操作</Text>
        </div>
        <div style={{ marginBottom: 20 }}>
          <Space wrap>
            <Button 
              type="tertiary"
              onClick={async () => {
                try {
                  const res = await API.get('/api/oauth/jwks');
                  Modal.info({
                    title: 'JWKS信息',
                    content: (
                      <div>
                        <Text>JSON Web Key Set:</Text>
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
                  showError('获取JWKS失败');
                }
              }}
            >
              查看JWKS
            </Button>
            <Button 
              type="tertiary"
              onClick={async () => {
                try {
                  const res = await API.get('/api/oauth/server-info');
                  Modal.info({
                    title: 'OAuth2服务器信息',
                    content: (
                      <div>
                        <Text>授权服务器配置:</Text>
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
                  showError('获取服务器信息失败');
                }
              }}
            >
              查看服务器信息
            </Button>
            <Button 
              type="tertiary"
              onClick={() => showInfo('OAuth2集成文档功能开发中，请参考相关API文档')}
            >
              集成文档
            </Button>
          </Space>
        </div>
      </Form.Section>
    </Card>

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
        title="客户端密钥已重新生成"
        visible={showSecretModal}
        onCancel={() => setShowSecretModal(false)}
        onOk={() => setShowSecretModal(false)}
        cancelText=""
        okText="我已复制保存"
        width={600}
      >
        <div>
          <Text>新的客户端密钥如下，请立即复制保存。关闭此窗口后将无法再次查看。</Text>
          <div style={{ 
            background: '#f8f9fa', 
            padding: '16px', 
            borderRadius: '6px',
            marginTop: '16px',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}>
            <Text code copyable>{currentSecret}</Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}