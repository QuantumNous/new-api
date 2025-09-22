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

import React, { useEffect, useState, useRef } from 'react';
import {
  SideSheet,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Button,
  Card,
  Avatar,
  Tag,
  Spin,
  Radio,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconKey,
  IconLink,
  IconSave,
  IconClose,
  IconPlus,
  IconDelete,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ClientInfoModal from './ClientInfoModal';

const { Text, Title } = Typography;
const { Option } = Select;

const AUTH_CODE = 'authorization_code';
const CLIENT_CREDENTIALS = 'client_credentials';

// 子组件：重定向URI编辑卡片
function RedirectUriCard({
  t,
  isAuthCodeSelected,
  redirectUris,
  onAdd,
  onUpdate,
  onRemove,
  onFillTemplate,
}) {
  return (
    <Card
      header={
        <div className='flex justify-between items-center'>
          <div className='flex items-center'>
            <Avatar size='small' color='purple' className='mr-2 shadow-md'>
              <IconLink size={16} />
            </Avatar>
            <div>
              <Text className='text-lg font-medium'>{t('重定向URI配置')}</Text>
              <div className='text-xs text-gray-600'>
                {t('用于授权码流程的重定向地址')}
              </div>
            </div>
          </div>
          <Button
            type='tertiary'
            onClick={onFillTemplate}
            size='small'
            disabled={!isAuthCodeSelected}
          >
            {t('填入示例模板')}
          </Button>
        </div>
      }
      headerStyle={{ padding: '12px 16px' }}
      bodyStyle={{ padding: '16px' }}
      className='!rounded-2xl shadow-sm border-0'
    >
      <div className='space-y-1'>
        {redirectUris.length === 0 && (
          <div className='text-center py-4 px-4'>
            <Text type='tertiary' className='text-gray-500 text-sm'>
              {t('暂无重定向URI，点击下方按钮添加')}
            </Text>
          </div>
        )}

        {redirectUris.map((uri, index) => (
          <div
            key={index}
            style={{
              marginBottom: 8,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Input
              placeholder={t('例如：https://your-app.com/callback')}
              value={uri}
              onChange={(value) => onUpdate(index, value)}
              style={{ flex: 1 }}
              disabled={!isAuthCodeSelected}
            />
            <Button
              icon={<IconDelete />}
              type='danger'
              theme='borderless'
              onClick={() => onRemove(index)}
              disabled={!isAuthCodeSelected}
            />
          </div>
        ))}

        <div className='py-2 flex justify-center gap-2'>
          <Button
            icon={<IconPlus />}
            type='primary'
            theme='outline'
            onClick={onAdd}
            disabled={!isAuthCodeSelected}
          >
            {t('添加重定向URI')}
          </Button>
        </div>
      </div>

      <Divider margin='12px' align='center'>
        <Text type='tertiary' size='small'>
          {isAuthCodeSelected
            ? t(
                '用户授权后将重定向到这些URI。必须使用HTTPS（本地开发可使用HTTP，仅限localhost/127.0.0.1）',
              )
            : t('仅在选择“授权码”授权类型时需要配置重定向URI')}
        </Text>
      </Divider>
    </Card>
  );
}

const OAuth2ClientModal = ({ visible, client, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [redirectUris, setRedirectUris] = useState([]);
  const [clientType, setClientType] = useState('confidential');
  const [grantTypes, setGrantTypes] = useState([]);
  const [allowedGrantTypes, setAllowedGrantTypes] = useState([
    CLIENT_CREDENTIALS,
    AUTH_CODE,
    'refresh_token',
  ]);

  // ClientInfoModal 状态
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [clientInfo, setClientInfo] = useState({
    clientId: '',
    clientSecret: '',
  });

  const isEdit = client?.id !== undefined;
  const [mode, setMode] = useState('create'); // 'create' | 'edit'
  useEffect(() => {
    if (visible) {
      setMode(isEdit ? 'edit' : 'create');
    }
  }, [visible, isEdit]);

  const getInitValues = () => ({
    name: '',
    description: '',
    client_type: 'confidential',
    grant_types: [],
    scopes: [],
    require_pkce: true,
    status: 1,
  });

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
        // 忽略错误，使用默认allowedGrantTypes
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setGrantTypes((prev) => {
      const normalizedPrev = Array.isArray(prev) ? prev : [];
      // 移除不被允许或与客户端类型冲突的类型
      let next = normalizedPrev.filter((g) => allowedGrantTypes.includes(g));
      if (clientType === 'public') {
        next = next.filter((g) => g !== CLIENT_CREDENTIALS);
      }
      return next.length ? next : [];
    });
  }, [clientType, allowedGrantTypes]);

  // 初始化表单数据（编辑模式）
  useEffect(() => {
    if (client && visible && isEdit) {
      setLoading(true);
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
          const parsed =
            typeof client.redirect_uris === 'string'
              ? JSON.parse(client.redirect_uris)
              : client.redirect_uris;
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedRedirectUris = parsed;
          }
        } catch (e) {}
      }

      // 过滤不被允许或不兼容的授权类型
      const filteredGrantTypes = (parsedGrantTypes || []).filter((g) =>
        allowedGrantTypes.includes(g),
      );
      const finalGrantTypes =
        client.client_type === 'public'
          ? filteredGrantTypes.filter((g) => g !== CLIENT_CREDENTIALS)
          : filteredGrantTypes;

      setClientType(client.client_type);
      setGrantTypes(finalGrantTypes);
      // 不自动新增空白URI，保持与创建模式一致的手动添加体验
      setRedirectUris(parsedRedirectUris);

      // 设置表单值
      const formValues = {
        id: client.id,
        name: client.name,
        description: client.description,
        client_type: client.client_type,
        grant_types: finalGrantTypes,
        scopes: parsedScopes,
        require_pkce: !!client.require_pkce,
        status: client.status,
      };

      setTimeout(() => {
        if (formApiRef.current) {
          formApiRef.current.setValues(formValues);
        }
        setLoading(false);
      }, 100);
    } else if (visible && !isEdit) {
      // 创建模式，重置状态
      setClientType('confidential');
      setGrantTypes([]);
      setRedirectUris([]);
      if (formApiRef.current) {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [client, visible, isEdit, allowedGrantTypes]);

  const isAuthCodeSelected = grantTypes.includes(AUTH_CODE);
  const isGrantTypeDisabled = (value) => {
    if (!allowedGrantTypes.includes(value)) return true;
    if (clientType === 'public' && value === CLIENT_CREDENTIALS) return true;
    return false;
  };

  // URL校验：允许 https；http 仅限本地开发域名
  const isValidRedirectUri = (uri) => {
    if (!uri || !uri.trim()) return false;
    try {
      const u = new URL(uri.trim());
      if (u.protocol === 'https:') return true;
      if (u.protocol === 'http:') {
        const host = u.hostname;
        return (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host.endsWith('.local')
        );
      }
      return false;
    } catch (_) {
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
        showError(t('请至少选择一种授权类型'));
        setLoading(false);
        return;
      }

      // 校验是否包含不被允许的授权类型
      const invalids = grantTypes.filter((g) => !allowedGrantTypes.includes(g));
      if (invalids.length) {
        showError(
          t('不被允许的授权类型: {{types}}', { types: invalids.join(', ') }),
        );
        setLoading(false);
        return;
      }

      if (clientType === 'public' && grantTypes.includes(CLIENT_CREDENTIALS)) {
        showError(t('公开客户端不允许使用client_credentials授权类型'));
        setLoading(false);
        return;
      }

      if (grantTypes.includes(AUTH_CODE)) {
        if (!validRedirectUris.length) {
          showError(t('选择授权码授权类型时，必须填写至少一个重定向URI'));
          setLoading(false);
          return;
        }
        const allValid = validRedirectUris.every(isValidRedirectUri);
        if (!allValid) {
          showError(t('重定向URI格式不合法：仅支持https，或本地开发使用http'));
          setLoading(false);
          return;
        }
      }

      // 避免把 Radio 组件对象形式的 client_type 直接传给后端
      const { client_type: _formClientType, ...restValues } = values || {};
      const payload = {
        ...restValues,
        client_type: clientType,
        grant_types: grantTypes,
        redirect_uris: validRedirectUris,
      };

      let res;
      if (isEdit) {
        res = await API.put('/api/oauth_clients/', payload);
      } else {
        res = await API.post('/api/oauth_clients/', payload);
      }

      const { success, message, client_id, client_secret } = res.data;

      if (success) {
        if (isEdit) {
          showSuccess(t('OAuth2客户端更新成功'));
          resetForm();
          onSuccess();
        } else {
          showSuccess(t('OAuth2客户端创建成功'));
          // 显示客户端信息
          setClientInfo({
            clientId: client_id,
            clientSecret: client_secret,
          });
          setShowClientInfo(true);
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(isEdit ? t('更新OAuth2客户端失败') : t('创建OAuth2客户端失败'));
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    if (formApiRef.current) {
      formApiRef.current.reset();
    }
    setClientType('confidential');
    setGrantTypes([]);
    setRedirectUris([]);
  };

  // 处理ClientInfoModal关闭
  const handleClientInfoClose = () => {
    setShowClientInfo(false);
    setClientInfo({ clientId: '', clientSecret: '' });
    resetForm();
    onSuccess();
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

  // 填入示例重定向URI模板
  const fillRedirectUriTemplate = () => {
    const template = [
      'https://your-app.com/auth/callback',
      'https://localhost:3000/callback',
    ];
    setRedirectUris(template);
  };

  // 授权类型变化处理（清理非法项，只设置一次）
  const handleGrantTypesChange = (values) => {
    const allowed = Array.isArray(values)
      ? values.filter((v) => allowedGrantTypes.includes(v))
      : [];
    const sanitized =
      clientType === 'public'
        ? allowed.filter((v) => v !== CLIENT_CREDENTIALS)
        : allowed;
    setGrantTypes(sanitized);
    if (formApiRef.current) {
      formApiRef.current.setValue('grant_types', sanitized);
    }
  };

  // 客户端类型变化处理（兼容 RadioGroup 事件对象与直接值）
  const handleClientTypeChange = (next) => {
    const value = next && next.target ? next.target.value : next;
    setClientType(value);
    // 公开客户端自动移除 client_credentials，并同步表单字段
    const current = Array.isArray(grantTypes) ? grantTypes : [];
    const sanitized =
      value === 'public'
        ? current.filter((g) => g !== CLIENT_CREDENTIALS)
        : current;
    if (sanitized !== current) {
      setGrantTypes(sanitized);
      if (formApiRef.current) {
        formApiRef.current.setValue('grant_types', sanitized);
      }
    }
  };

  return (
    <SideSheet
      placement={mode === 'edit' ? 'right' : 'left'}
      title={
        <Space>
          {mode === 'edit' ? (
            <Tag color='blue' shape='circle'>
              {t('编辑')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('创建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {mode === 'edit' ? t('编辑OAuth2客户端') : t('创建OAuth2客户端')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={isMobile ? '100%' : 700}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<IconSave />}
              loading={loading}
            >
              {isEdit ? t('保存') : t('创建')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
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
      onCancel={handleCancel}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? `edit-${client?.id}` : 'create'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={handleSubmit}
        >
          {() => (
            <div className='p-2'>
              {/* 表单内容 */}
              {/* 基本信息 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-4'>
                  <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                    <IconKey size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置客户端的基本信息')}
                    </div>
                  </div>
                </div>
                {isEdit && (
                  <>
                    <Form.Select
                      field='status'
                      label={t('状态')}
                      rules={[{ required: true, message: t('请选择状态') }]}
                      required
                    >
                      <Option value={1}>{t('启用')}</Option>
                      <Option value={2}>{t('禁用')}</Option>
                    </Form.Select>
                    <Form.Input field='id' label={t('客户端ID')} disabled />
                  </>
                )}
                <Form.Input
                  field='name'
                  label={t('客户端名称')}
                  placeholder={t('输入客户端名称')}
                  rules={[{ required: true, message: t('请输入客户端名称') }]}
                  required
                  showClear
                />
                <Form.TextArea
                  field='description'
                  label={t('描述')}
                  placeholder={t('输入客户端描述')}
                  rows={3}
                  showClear
                />
                <Form.RadioGroup
                  label={t('客户端类型')}
                  field='client_type'
                  value={clientType}
                  onChange={handleClientTypeChange}
                  type='card'
                  aria-label={t('选择客户端类型')}
                  disabled={isEdit}
                  rules={[{ required: true, message: t('请选择客户端类型') }]}
                  required
                >
                  <Radio
                    value='confidential'
                    extra={t('服务器端应用，安全地存储客户端密钥')}
                    style={{ width: isMobile ? '100%' : 'auto' }}
                  >
                    {t('机密客户端（Confidential）')}
                  </Radio>
                  <Radio
                    value='public'
                    extra={t('移动应用或单页应用，无法安全存储密钥')}
                    style={{ width: isMobile ? '100%' : 'auto' }}
                  >
                    {t('公开客户端（Public）')}
                  </Radio>
                </Form.RadioGroup>
                <Form.Select
                  field='grant_types'
                  label={t('允许的授权类型')}
                  multiple
                  value={grantTypes}
                  onChange={handleGrantTypesChange}
                  rules={[
                    { required: true, message: t('请选择至少一种授权类型') },
                  ]}
                  required
                  placeholder={t('请选择授权类型（可多选）')}
                >
                  {clientType !== 'public' && (
                    <Option
                      value={CLIENT_CREDENTIALS}
                      disabled={isGrantTypeDisabled(CLIENT_CREDENTIALS)}
                    >
                      {t('Client Credentials（客户端凭证）')}
                    </Option>
                  )}
                  <Option
                    value={AUTH_CODE}
                    disabled={isGrantTypeDisabled(AUTH_CODE)}
                  >
                    {t('Authorization Code（授权码）')}
                  </Option>
                  <Option
                    value='refresh_token'
                    disabled={isGrantTypeDisabled('refresh_token')}
                  >
                    {t('Refresh Token（刷新令牌）')}
                  </Option>
                </Form.Select>
                <Form.Select
                  field='scopes'
                  label={t('允许的权限范围（Scope）')}
                  multiple
                  rules={[
                    { required: true, message: t('请选择至少一个权限范围') },
                  ]}
                  required
                  placeholder={t('请选择权限范围（可多选）')}
                >
                  <Option value='openid'>{t('openid（OIDC 基础身份）')}</Option>
                  <Option value='profile'>
                    {t('profile（用户名/昵称等）')}
                  </Option>
                  <Option value='email'>{t('email（邮箱信息）')}</Option>
                  <Option value='api:read'>
                    {`api:read (${t('读取API')})`}
                  </Option>
                  <Option value='api:write'>
                    {`api:write (${t('写入API')})`}
                  </Option>
                  <Option value='admin'>{t('admin（管理员权限）')}</Option>
                </Form.Select>
                <Form.Switch
                  field='require_pkce'
                  label={t('强制PKCE验证')}
                  size='large'
                  extraText={t(
                    'PKCE（Proof Key for Code Exchange）可提高授权码流程的安全性。',
                  )}
                />
              </Card>

              {/* 重定向URI */}
              <RedirectUriCard
                t={t}
                isAuthCodeSelected={isAuthCodeSelected}
                redirectUris={redirectUris}
                onAdd={addRedirectUri}
                onUpdate={updateRedirectUri}
                onRemove={removeRedirectUri}
                onFillTemplate={fillRedirectUriTemplate}
              />
            </div>
          )}
        </Form>
      </Spin>

      {/* 客户端信息展示模态框 */}
      <ClientInfoModal
        visible={showClientInfo}
        onClose={handleClientInfoClose}
        clientId={clientInfo.clientId}
        clientSecret={clientInfo.clientSecret}
      />
    </SideSheet>
  );
};

export default OAuth2ClientModal;
