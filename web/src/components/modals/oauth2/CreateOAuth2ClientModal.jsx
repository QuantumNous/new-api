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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  TextArea,
  Switch,
  Space,
  Typography,
  Divider,
  Tag,
  Button,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showInfo } from '../../../helpers';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const CreateOAuth2ClientModal = ({ visible, onCancel, onSuccess }) => {
  const [formApi, setFormApi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redirectUris, setRedirectUris] = useState([]);
  const [clientType, setClientType] = useState('confidential');
  const [grantTypes, setGrantTypes] = useState(['client_credentials']);
  const [allowedGrantTypes, setAllowedGrantTypes] = useState([
    'client_credentials',
    'authorization_code',
    'refresh_token',
  ]);

  // 加载后端允许的授权类型（用于限制和默认值）
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get('/api/option/');
        const { success, data } = res.data || {};
        if (!success || !Array.isArray(data)) return;
        const found = data.find((i) => i.key === 'oauth2.allowed_grant_types');
        if (!found) return;
        let parsed = [];
        try {
          parsed = JSON.parse(found.value || '[]');
        } catch (_) {}
        if (mounted && Array.isArray(parsed) && parsed.length) {
          setAllowedGrantTypes(parsed);
        }
      } catch (_) {
        // 忽略错误，使用默认allowedGrantTypes
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const computeDefaultGrantTypes = (type, allowed) => {
    const cand =
      type === 'public'
        ? ['authorization_code', 'refresh_token']
        : ['client_credentials', 'authorization_code', 'refresh_token'];
    const subset = cand.filter((g) => allowed.includes(g));
    return subset.length ? subset : [allowed[0]].filter(Boolean);
  };

  // 当允许的类型或客户端类型变化时，自动设置更合理的默认值
  useEffect(() => {
    setGrantTypes((prev) => {
      const normalizedPrev = Array.isArray(prev) ? prev : [];
      // 移除不被允许或与客户端类型冲突的类型
      let next = normalizedPrev.filter((g) => allowedGrantTypes.includes(g));
      if (clientType === 'public') {
        next = next.filter((g) => g !== 'client_credentials');
      }
      // 如果为空，则使用计算的默认
      if (!next.length) {
        next = computeDefaultGrantTypes(clientType, allowedGrantTypes);
      }
      return next;
    });
  }, [clientType, allowedGrantTypes]);

  const isGrantTypeDisabled = (value) => {
    if (!allowedGrantTypes.includes(value)) return true;
    if (clientType === 'public' && value === 'client_credentials') return true;
    return false;
  };

  // URL校验：允许 http(s)，本地开发可 http
  const isValidRedirectUri = (uri) => {
    if (!uri || !uri.trim()) return false;
    try {
      const u = new URL(uri.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      if (u.protocol === 'http:') {
        // 仅允许本地开发时使用 http
        const host = u.hostname;
        const isLocal =
          host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
        if (!isLocal) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  // 处理提交
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // 过滤空的重定向URI
      const validRedirectUris = redirectUris
        .map((u) => (u || '').trim())
        .filter((u) => u.length > 0);

      // 业务校验
      if (!grantTypes.length) {
        showError('请至少选择一种授权类型');
        return;
      }
      // 校验是否包含不被允许的授权类型
      const invalids = grantTypes.filter((g) => !allowedGrantTypes.includes(g));
      if (invalids.length) {
        showError(`不被允许的授权类型: ${invalids.join(', ')}`);
        return;
      }
      if (clientType === 'public' && grantTypes.includes('client_credentials')) {
        showError('公开客户端不允许使用client_credentials授权类型');
        return;
      }
      if (grantTypes.includes('authorization_code')) {
        if (!validRedirectUris.length) {
          showError('选择授权码授权类型时，必须填写至少一个重定向URI');
          return;
        }
        const allValid = validRedirectUris.every(isValidRedirectUri);
        if (!allValid) {
          showError('重定向URI格式不合法：仅支持https，或本地开发使用http');
          return;
        }
      }

      const payload = {
        ...values,
        client_type: clientType,
        grant_types: grantTypes,
        redirect_uris: validRedirectUris,
      };

      const res = await API.post('/api/oauth_clients/', payload);
      const { success, message, client_id, client_secret } = res.data;
      
      if (success) {
        showSuccess('OAuth2客户端创建成功');
        
        // 显示客户端信息
        Modal.info({
          title: '客户端创建成功',
          content: (
            <div>
              <Paragraph>请妥善保存以下信息：</Paragraph>
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <Text strong>客户端ID：</Text>
                  <br />
                  <Text code copyable style={{ fontFamily: 'monospace' }}>
                    {client_id}
                  </Text>
                </div>
                {client_secret && (
                  <div>
                    <Text strong>客户端密钥（仅此一次显示）：</Text>
                    <br />
                    <Text code copyable style={{ fontFamily: 'monospace' }}>
                      {client_secret}
                    </Text>
                  </div>
                )}
              </div>
              <Paragraph type="warning" style={{ marginTop: '12px' }}>
                {client_secret 
                  ? '客户端密钥仅显示一次，请立即复制保存。' 
                  : '公开客户端无需密钥。'
                }
              </Paragraph>
            </div>
          ),
          width: 600,
          onOk: () => {
            resetForm();
            onSuccess();
          }
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError('创建OAuth2客户端失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    if (formApi) {
      formApi.reset();
    }
    setClientType('confidential');
    setGrantTypes(computeDefaultGrantTypes('confidential', allowedGrantTypes));
    setRedirectUris([]);
  };

  // 处理取消
  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  // 添加重定向URI
  const addRedirectUri = () => {
    setRedirectUris([...redirectUris, '']);
  };

  // 删除重定向URI
  const removeRedirectUri = (index) => {
    setRedirectUris(redirectUris.filter((_, i) => i !== index));
  };

  // 更新重定向URI
  const updateRedirectUri = (index, value) => {
    const newUris = [...redirectUris];
    newUris[index] = value;
    setRedirectUris(newUris);
  };

  // 授权类型变化处理
  const handleGrantTypesChange = (values) => {
    setGrantTypes(values);
    // 如果包含authorization_code但没有重定向URI，则添加一个
    if (values.includes('authorization_code') && redirectUris.length === 0) {
      setRedirectUris(['']);
    }
    // 公开客户端不允许client_credentials
    if (clientType === 'public' && values.includes('client_credentials')) {
      setGrantTypes(values.filter((v) => v !== 'client_credentials'));
    }
  };

  return (
    <Modal
      title="创建OAuth2客户端"
      visible={visible}
      onCancel={handleCancel}
      onOk={() => formApi?.submitForm()}
      okText="创建"
      cancelText="取消"
      confirmLoading={loading}
      width={600}
      style={{ top: 50 }}
    >
      <Form
        getFormApi={(api) => setFormApi(api)}
        initValues={{
          // 表单默认值优化：预置 OIDC 常用 scope
          scopes: ['openid', 'profile', 'email', 'api:read'],
          require_pkce: true,
          grant_types: grantTypes,
        }}
        onSubmit={handleSubmit}
        labelPosition="top"
      >
        {/* 基本信息 */}
        <Form.Input
          field="name"
          label="客户端名称"
          placeholder="输入客户端名称"
          rules={[{ required: true, message: '请输入客户端名称' }]}
        />

        <Form.TextArea
          field="description"
          label="描述"
          placeholder="输入客户端描述"
          rows={3}
        />

        {/* 客户端类型 */}
        <div>
          <Text strong>客户端类型</Text>
          <Paragraph type="tertiary" size="small" style={{ marginTop: 4, marginBottom: 8 }}>
            选择适合您应用程序的客户端类型。
          </Paragraph>
          <div style={{ display: 'flex', gap: '12px', marginBottom: 16 }}>
            <div 
              onClick={() => setClientType('confidential')}
              style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${clientType === 'confidential' ? '#3370ff' : '#e4e6e9'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                background: clientType === 'confidential' ? '#f0f5ff' : '#fff'
              }}
            >
              <Text strong>机密客户端（Confidential）</Text>
              <Paragraph type="tertiary" size="small" style={{ margin: '4px 0 0 0' }}>
                用于服务器端应用，可以安全地存储客户端密钥
              </Paragraph>
            </div>
            <div 
              onClick={() => setClientType('public')}
              style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${clientType === 'public' ? '#3370ff' : '#e4e6e9'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                background: clientType === 'public' ? '#f0f5ff' : '#fff'
              }}
            >
              <Text strong>公开客户端（Public）</Text>
              <Paragraph type="tertiary" size="small" style={{ margin: '4px 0 0 0' }}>
                用于移动应用或单页应用，无法安全存储密钥
              </Paragraph>
            </div>
          </div>
        </div>

        {/* 授权类型 */}
        <Form.Select
          field="grant_types"
          label="允许的授权类型"
          multiple
          value={grantTypes}
          onChange={handleGrantTypesChange}
          rules={[{ required: true, message: '请选择至少一种授权类型' }]}
        >
          <Option value="client_credentials" disabled={isGrantTypeDisabled('client_credentials')}>
            Client Credentials（客户端凭证）
          </Option>
          <Option value="authorization_code" disabled={isGrantTypeDisabled('authorization_code')}>
            Authorization Code（授权码）
          </Option>
          <Option value="refresh_token" disabled={isGrantTypeDisabled('refresh_token')}>
            Refresh Token（刷新令牌）
          </Option>
        </Form.Select>

        {/* Scope */}
        <Form.Select
          field="scopes"
          label="允许的权限范围（Scope）"
          multiple
          rules={[{ required: true, message: '请选择至少一个权限范围' }]}
        >
          <Option value="openid">openid（OIDC 基础身份）</Option>
          <Option value="profile">profile（用户名/昵称等）</Option>
          <Option value="email">email（邮箱信息）</Option>
          <Option value="api:read">api:read（读取API）</Option>
          <Option value="api:write">api:write（写入API）</Option>
          <Option value="admin">admin（管理员权限）</Option>
        </Form.Select>

        {/* PKCE设置 */}
        <Form.Switch
          field="require_pkce"
          label="强制PKCE验证"
        />
        <Paragraph type="tertiary" size="small" style={{ marginTop: -8, marginBottom: 16 }}>
          PKCE（Proof Key for Code Exchange）可提高授权码流程的安全性。
        </Paragraph>

        {/* 重定向URI */}
        {(grantTypes.includes('authorization_code') || redirectUris.length > 0) && (
          <>
            <Divider>重定向URI配置</Divider>
            <div style={{ marginBottom: 16 }}>
              <Text strong>重定向URI</Text>
              <Paragraph type="tertiary" size="small">
                用于授权码流程，用户授权后将重定向到这些URI。必须使用HTTPS（本地开发可使用HTTP，仅限localhost/127.0.0.1）。
              </Paragraph>
              
              <Space direction="vertical" style={{ width: '100%' }}>
                {redirectUris.map((uri, index) => (
                  <Space key={index} style={{ width: '100%' }}>
                    <Input
                      placeholder="https://your-app.com/callback"
                      value={uri}
                      onChange={(value) => updateRedirectUri(index, value)}
                      style={{ flex: 1 }}
                    />
                    {redirectUris.length > 1 && (
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        icon={<IconDelete />}
                        onClick={() => removeRedirectUri(index)}
                      />
                    )}
                  </Space>
                ))}
              </Space>
              
              <Button
                theme="borderless"
                type="primary"
                size="small"
                icon={<IconPlus />}
                onClick={addRedirectUri}
                style={{ marginTop: 8 }}
              >
                添加重定向URI
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default CreateOAuth2ClientModal;
