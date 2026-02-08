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
  Button,
  Form,
  Row,
  Col,
  Typography,
  Modal,
  Banner,
  Card,
  Table,
  Tag,
  Popconfirm,
  Space,
  Select,
} from '@douyinfe/semi-ui';
import { IconPlus, IconEdit, IconDelete } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// Preset templates for common OAuth providers
const OAUTH_PRESETS = {
  'github-enterprise': {
    name: 'GitHub Enterprise',
    authorization_endpoint: '/login/oauth/authorize',
    token_endpoint: '/login/oauth/access_token',
    user_info_endpoint: '/api/v3/user',
    scopes: 'user:email',
    user_id_field: 'id',
    username_field: 'login',
    display_name_field: 'name',
    email_field: 'email',
  },
  gitlab: {
    name: 'GitLab',
    authorization_endpoint: '/oauth/authorize',
    token_endpoint: '/oauth/token',
    user_info_endpoint: '/api/v4/user',
    scopes: 'openid profile email',
    user_id_field: 'id',
    username_field: 'username',
    display_name_field: 'name',
    email_field: 'email',
  },
  gitea: {
    name: 'Gitea',
    authorization_endpoint: '/login/oauth/authorize',
    token_endpoint: '/login/oauth/access_token',
    user_info_endpoint: '/api/v1/user',
    scopes: 'openid profile email',
    user_id_field: 'id',
    username_field: 'login',
    display_name_field: 'full_name',
    email_field: 'email',
  },
  nextcloud: {
    name: 'Nextcloud',
    authorization_endpoint: '/apps/oauth2/authorize',
    token_endpoint: '/apps/oauth2/api/v1/token',
    user_info_endpoint: '/ocs/v2.php/cloud/user?format=json',
    scopes: 'openid profile email',
    user_id_field: 'ocs.data.id',
    username_field: 'ocs.data.id',
    display_name_field: 'ocs.data.displayname',
    email_field: 'ocs.data.email',
  },
  keycloak: {
    name: 'Keycloak',
    authorization_endpoint: '/realms/{realm}/protocol/openid-connect/auth',
    token_endpoint: '/realms/{realm}/protocol/openid-connect/token',
    user_info_endpoint: '/realms/{realm}/protocol/openid-connect/userinfo',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
  authentik: {
    name: 'Authentik',
    authorization_endpoint: '/application/o/authorize/',
    token_endpoint: '/application/o/token/',
    user_info_endpoint: '/application/o/userinfo/',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
  ory: {
    name: 'ORY Hydra',
    authorization_endpoint: '/oauth2/auth',
    token_endpoint: '/oauth2/token',
    user_info_endpoint: '/userinfo',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
};

const CustomOAuthSetting = ({ serverAddress }) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [selectedPreset, setSelectedPreset] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const formApiRef = React.useRef(null);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/custom-oauth-provider/');
      if (res.data.success) {
        setProviders(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取自定义 OAuth 提供商列表失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAdd = () => {
    setEditingProvider(null);
    setFormValues({
      enabled: false,
      scopes: 'openid profile email',
      user_id_field: 'sub',
      username_field: 'preferred_username',
      display_name_field: 'name',
      email_field: 'email',
      auth_style: 0,
    });
    setSelectedPreset('');
    setBaseUrl('');
    setModalVisible(true);
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormValues({ ...provider });
    setSelectedPreset('');
    setBaseUrl('');
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await API.delete(`/api/custom-oauth-provider/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        fetchProviders();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const requiredFields = [
      'name',
      'slug',
      'client_id',
      'authorization_endpoint',
      'token_endpoint',
      'user_info_endpoint',
    ];
    
    if (!editingProvider) {
      requiredFields.push('client_secret');
    }

    for (const field of requiredFields) {
      if (!formValues[field]) {
        showError(t(`请填写 ${field}`));
        return;
      }
    }

    // Validate endpoint URLs must be full URLs
    const endpointFields = ['authorization_endpoint', 'token_endpoint', 'user_info_endpoint'];
    for (const field of endpointFields) {
      const value = formValues[field];
      if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
        // Check if user selected a preset but forgot to fill server address
        if (selectedPreset && !baseUrl) {
          showError(t('请先填写服务器地址，以自动生成完整的端点 URL'));
        } else {
          showError(t('端点 URL 必须是完整地址（以 http:// 或 https:// 开头）'));
        }
        return;
      }
    }

    try {
      let res;
      if (editingProvider) {
        res = await API.put(
          `/api/custom-oauth-provider/${editingProvider.id}`,
          formValues
        );
      } else {
        res = await API.post('/api/custom-oauth-provider/', formValues);
      }

      if (res.data.success) {
        showSuccess(editingProvider ? t('更新成功') : t('创建成功'));
        setModalVisible(false);
        fetchProviders();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(editingProvider ? t('更新失败') : t('创建失败'));
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (preset && OAUTH_PRESETS[preset]) {
      const presetConfig = OAUTH_PRESETS[preset];
      const cleanUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
      const newValues = {
        name: presetConfig.name,
        slug: preset,
        scopes: presetConfig.scopes,
        user_id_field: presetConfig.user_id_field,
        username_field: presetConfig.username_field,
        display_name_field: presetConfig.display_name_field,
        email_field: presetConfig.email_field,
        auth_style: presetConfig.auth_style ?? 0,
      };
      // Only fill endpoints if server address is provided
      if (cleanUrl) {
        newValues.authorization_endpoint = cleanUrl + presetConfig.authorization_endpoint;
        newValues.token_endpoint = cleanUrl + presetConfig.token_endpoint;
        newValues.user_info_endpoint = cleanUrl + presetConfig.user_info_endpoint;
      }
      setFormValues((prev) => ({ ...prev, ...newValues }));
      // Update form fields directly via formApi
      if (formApiRef.current) {
        Object.entries(newValues).forEach(([key, value]) => {
          formApiRef.current.setValue(key, value);
        });
      }
    }
  };

  const handleBaseUrlChange = (url) => {
    setBaseUrl(url);
    if (url && selectedPreset && OAUTH_PRESETS[selectedPreset]) {
      const presetConfig = OAUTH_PRESETS[selectedPreset];
      const cleanUrl = url.replace(/\/+$/, ''); // Remove trailing slashes
      const newValues = {
        authorization_endpoint: cleanUrl + presetConfig.authorization_endpoint,
        token_endpoint: cleanUrl + presetConfig.token_endpoint,
        user_info_endpoint: cleanUrl + presetConfig.user_info_endpoint,
      };
      setFormValues((prev) => ({ ...prev, ...newValues }));
      // Update form fields directly via formApi (use merge mode to preserve other fields)
      if (formApiRef.current) {
        Object.entries(newValues).forEach(([key, value]) => {
          formApiRef.current.setValue(key, value);
        });
      }
    }
  };

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug) => <Tag>{slug}</Tag>,
    },
    {
      title: t('状态'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'grey'}>
          {enabled ? t('已启用') : t('已禁用')}
        </Tag>
      ),
    },
    {
      title: t('Client ID'),
      dataIndex: 'client_id',
      key: 'client_id',
      render: (id) => (id ? id.substring(0, 20) + '...' : '-'),
    },
    {
      title: t('操作'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<IconEdit />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确定要删除此 OAuth 提供商吗？')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<IconDelete />} size="small" type="danger">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Form.Section text={t('自定义 OAuth 提供商')}>
        <Banner
          type="info"
          description={
            <>
              {t(
                '配置自定义 OAuth 提供商，支持 GitHub Enterprise、GitLab、Gitea、Nextcloud、Keycloak、ORY 等兼容 OAuth 2.0 协议的身份提供商'
              )}
              <br />
              {t('回调 URL 格式')}: {serverAddress || t('网站地址')}/oauth/
              {'{slug}'}
            </>
          }
          style={{ marginBottom: 20 }}
        />

        <Button
          icon={<IconPlus />}
          theme="solid"
          onClick={handleAdd}
          style={{ marginBottom: 16 }}
        >
          {t('添加 OAuth 提供商')}
        </Button>

        <Table
          columns={columns}
          dataSource={providers}
          loading={loading}
          rowKey="id"
          pagination={false}
          empty={t('暂无自定义 OAuth 提供商')}
        />

        <Modal
          title={editingProvider ? t('编辑 OAuth 提供商') : t('添加 OAuth 提供商')}
          visible={modalVisible}
          onOk={handleSubmit}
          onCancel={() => setModalVisible(false)}
          okText={t('保存')}
          cancelText={t('取消')}
          width={800}
        >
          <Form
            initValues={formValues}
            onValueChange={(values) => setFormValues(values)}
            getFormApi={(api) => (formApiRef.current = api)}
          >
            {!editingProvider && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Form.Select
                    field="preset"
                    label={t('预设模板')}
                    placeholder={t('选择预设模板（可选）')}
                    value={selectedPreset}
                    onChange={handlePresetChange}
                    optionList={[
                      { value: '', label: t('自定义') },
                      ...Object.entries(OAUTH_PRESETS).map(([key, config]) => ({
                        value: key,
                        label: config.name,
                      })),
                    ]}
                  />
                </Col>
                <Col span={12}>
                  <Form.Input
                    field="base_url"
                    label={
                      selectedPreset
                        ? t('服务器地址') + ' *'
                        : t('服务器地址')
                    }
                    placeholder={t('例如：https://gitea.example.com')}
                    value={baseUrl}
                    onChange={handleBaseUrlChange}
                    extraText={
                      selectedPreset
                        ? t('必填：请输入服务器地址以自动生成完整端点 URL')
                        : t('选择预设模板后填写服务器地址可自动填充端点')
                    }
                  />
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="name"
                  label={t('显示名称')}
                  placeholder={t('例如：GitHub Enterprise')}
                  rules={[{ required: true, message: t('请输入显示名称') }]}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="slug"
                  label="Slug"
                  placeholder={t('例如：github-enterprise')}
                  extraText={t('URL 标识，只能包含小写字母、数字和连字符')}
                  rules={[{ required: true, message: t('请输入 Slug') }]}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="client_id"
                  label="Client ID"
                  placeholder={t('OAuth Client ID')}
                  rules={[{ required: true, message: t('请输入 Client ID') }]}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="client_secret"
                  label="Client Secret"
                  type="password"
                  placeholder={
                    editingProvider
                      ? t('留空则保持原有密钥')
                      : t('OAuth Client Secret')
                  }
                  rules={
                    editingProvider
                      ? []
                      : [{ required: true, message: t('请输入 Client Secret') }]
                  }
                />
              </Col>
            </Row>

            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
              {t('OAuth 端点')}
            </Text>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Input
                  field="authorization_endpoint"
                  label={t('Authorization Endpoint')}
                  placeholder={
                    selectedPreset && OAUTH_PRESETS[selectedPreset]
                      ? t('填写服务器地址后自动生成：') +
                        OAUTH_PRESETS[selectedPreset].authorization_endpoint
                      : 'https://example.com/oauth/authorize'
                  }
                  rules={[
                    { required: true, message: t('请输入 Authorization Endpoint') },
                  ]}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="token_endpoint"
                  label={t('Token Endpoint')}
                  placeholder={
                    selectedPreset && OAUTH_PRESETS[selectedPreset]
                      ? t('自动生成：') + OAUTH_PRESETS[selectedPreset].token_endpoint
                      : 'https://example.com/oauth/token'
                  }
                  rules={[{ required: true, message: t('请输入 Token Endpoint') }]}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="user_info_endpoint"
                  label={t('User Info Endpoint')}
                  placeholder={
                    selectedPreset && OAUTH_PRESETS[selectedPreset]
                      ? t('自动生成：') + OAUTH_PRESETS[selectedPreset].user_info_endpoint
                      : 'https://example.com/api/user'
                  }
                  rules={[
                    { required: true, message: t('请输入 User Info Endpoint') },
                  ]}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="scopes"
                  label={t('Scopes')}
                  placeholder="openid profile email"
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="well_known"
                  label={t('Well-Known URL')}
                  placeholder={t('OIDC Discovery 端点（可选）')}
                />
              </Col>
            </Row>

            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
              {t('字段映射')}
            </Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('配置如何从用户信息 API 响应中提取用户数据，支持 JSONPath 语法')}
            </Text>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="user_id_field"
                  label={t('用户 ID 字段')}
                  placeholder={t('例如：sub、id、data.user.id')}
                  extraText={t('用于唯一标识用户的字段路径')}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="username_field"
                  label={t('用户名字段')}
                  placeholder={t('例如：preferred_username、login')}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="display_name_field"
                  label={t('显示名称字段')}
                  placeholder={t('例如：name、full_name')}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="email_field"
                  label={t('邮箱字段')}
                  placeholder={t('例如：email')}
                />
              </Col>
            </Row>

            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
              {t('高级选项')}
            </Text>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Select
                  field="auth_style"
                  label={t('认证方式')}
                  optionList={[
                    { value: 0, label: t('自动检测') },
                    { value: 1, label: t('POST 参数') },
                    { value: 2, label: t('Basic Auth 头') },
                  ]}
                />
              </Col>
              <Col span={12}>
                <Form.Checkbox field="enabled" noLabel>
                  {t('启用此 OAuth 提供商')}
                </Form.Checkbox>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Form.Section>
    </Card>
  );
};

export default CustomOAuthSetting;
