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
  Modal,
  Form,
  Input,
  Select,
  TextArea,
  Switch,
  Space,
  Typography,
  Divider,
  Button,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const EditOAuth2ClientModal = ({ visible, client, onCancel, onSuccess }) => {
  const [formApi, setFormApi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redirectUris, setRedirectUris] = useState([]);
  const [grantTypes, setGrantTypes] = useState(['client_credentials']);
  const [allowedGrantTypes, setAllowedGrantTypes] = useState([
    'client_credentials',
    'authorization_code',
    'refresh_token',
  ]);

  // 加载后端允许的授权类型
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
        // 忽略错误
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 初始化表单数据
  useEffect(() => {
    if (client && visible) {
      // 解析授权类型
      let parsedGrantTypes = [];
      if (typeof client.grant_types === 'string') {
        parsedGrantTypes = client.grant_types.split(',');
      } else if (Array.isArray(client.grant_types)) {
        parsedGrantTypes = client.grant_types;
      }

      // 解析Scope
      let parsedScopes = [];
      if (typeof client.scopes === 'string') {
        parsedScopes = client.scopes.split(',');
      } else if (Array.isArray(client.scopes)) {
        parsedScopes = client.scopes;
      }
      if (!parsedScopes || parsedScopes.length === 0) {
        parsedScopes = ['openid', 'profile', 'email', 'api:read'];
      }

      // 解析重定向URI
      let parsedRedirectUris = [];
      if (client.redirect_uris) {
        try {
          const parsed = typeof client.redirect_uris === 'string' 
            ? JSON.parse(client.redirect_uris)
            : client.redirect_uris;
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedRedirectUris = parsed;
          }
        } catch (e) {
          console.warn('Failed to parse redirect URIs:', e);
        }
      }

      // 过滤不被允许或不兼容的授权类型
      const filteredGrantTypes = (parsedGrantTypes || []).filter((g) =>
        allowedGrantTypes.includes(g),
      );
      const finalGrantTypes = client.client_type === 'public'
        ? filteredGrantTypes.filter((g) => g !== 'client_credentials')
        : filteredGrantTypes;

      setGrantTypes(finalGrantTypes);
      if (finalGrantTypes.includes('authorization_code') && parsedRedirectUris.length === 0) {
        setRedirectUris(['']);
      } else {
        setRedirectUris(parsedRedirectUris);
      }

      // 设置表单值
      const formValues = {
        id: client.id,
        name: client.name,
        description: client.description,
        client_type: client.client_type,
        grant_types: parsedGrantTypes,
        scopes: parsedScopes,
        require_pkce: !!client.require_pkce,
        status: client.status,
      };
      if (formApi) {
        formApi.setValues(formValues);
      }
    }
  }, [client, visible, formApi]);

  // 处理提交
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // 过滤空的重定向URI
      const validRedirectUris = redirectUris
        .map((u) => (u || '').trim())
        .filter((u) => u.length > 0);

      // 校验授权类型
      if (!grantTypes.length) {
        showError('请至少选择一种授权类型');
        setLoading(false);
        return;
      }
      const invalids = grantTypes.filter((g) => !allowedGrantTypes.includes(g));
      if (invalids.length) {
        showError(`不被允许的授权类型: ${invalids.join(', ')}`);
        setLoading(false);
        return;
      }
      if (client?.client_type === 'public' && grantTypes.includes('client_credentials')) {
        showError('公开客户端不允许使用client_credentials授权类型');
        setLoading(false);
        return;
      }
      // 授权码需要有效重定向URI
      const isValidRedirectUri = (uri) => {
        if (!uri || !uri.trim()) return false;
        try {
          const u = new URL(uri.trim());
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
          if (u.protocol === 'http:') {
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
      if (grantTypes.includes('authorization_code')) {
        if (!validRedirectUris.length) {
          showError('选择授权码授权类型时，必须填写至少一个重定向URI');
          setLoading(false);
          return;
        }
        const allValid = validRedirectUris.every(isValidRedirectUri);
        if (!allValid) {
          showError('重定向URI格式不合法：仅支持https，或本地开发使用http');
          setLoading(false);
          return;
        }
      }
      
      const payload = {
        ...values,
        grant_types: grantTypes,
        redirect_uris: validRedirectUris,
      };

      const res = await API.put('/api/oauth_clients/', payload);
      const { success, message } = res.data;
      
      if (success) {
        showSuccess('OAuth2客户端更新成功');
        onSuccess();
      } else {
        showError(message);
      }
    } catch (error) {
      showError('更新OAuth2客户端失败');
    } finally {
      setLoading(false);
    }
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
    if (client?.client_type === 'public' && values.includes('client_credentials')) {
      setGrantTypes(values.filter((v) => v !== 'client_credentials'));
    }
  };

  if (!client) return null;

  return (
    <Modal
      title={`编辑OAuth2客户端 - ${client.name}`}
      visible={visible}
      onCancel={onCancel}
      onOk={() => formApi?.submitForm()}
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      width={600}
      style={{ top: 50 }}
    >
      <Form
        getFormApi={(api) => setFormApi(api)}
        onSubmit={handleSubmit}
        labelPosition="top"
      >
        {/* 客户端ID（只读） */}
        <Form.Input
          field="id"
          label="客户端ID"
          disabled
          style={{ backgroundColor: '#f8f9fa' }}
        />

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

        {/* 客户端类型（只读） */}
        <Form.Select
          field="client_type"
          label="客户端类型"
          disabled
          style={{ backgroundColor: '#f8f9fa' }}
        >
          <Option value="confidential">机密客户端（Confidential）</Option>
          <Option value="public">公开客户端（Public）</Option>
        </Form.Select>
        
        <Paragraph type="tertiary" size="small" style={{ marginTop: -8, marginBottom: 16 }}>
          客户端类型创建后不可更改。
        </Paragraph>

        {/* 授权类型 */}
        <Form.Select
          field="grant_types"
          label="允许的授权类型"
          multiple
          value={grantTypes}
          onChange={handleGrantTypesChange}
          rules={[{ required: true, message: '请选择至少一种授权类型' }]}
        >
          <Option value="client_credentials" disabled={
            client?.client_type === 'public' || !allowedGrantTypes.includes('client_credentials')
          }>
            Client Credentials（客户端凭证）
          </Option>
          <Option value="authorization_code" disabled={!allowedGrantTypes.includes('authorization_code')}>
            Authorization Code（授权码）
          </Option>
          <Option value="refresh_token" disabled={!allowedGrantTypes.includes('refresh_token')}>
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

        {/* 状态 */}
        <Form.Select
          field="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态' }]}
        >
          <Option value={1}>启用</Option>
          <Option value={2}>禁用</Option>
        </Form.Select>

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

export default EditOAuth2ClientModal;
