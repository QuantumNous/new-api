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
  API,
  showError,
  showSuccess,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Form,
  Col,
  Row,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IconLink,
  IconSave,
  IconClose,
  IconKey,
  IconCopy,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title, Paragraph } = Typography;

const AVAILABLE_SCOPES = [
  { value: 'openid', label: 'OpenID' },
  { value: 'profile', label: 'Profile' },
  { value: 'email', label: 'Email' },
  { value: 'offline_access', label: 'Offline Access' },
  { value: 'balance:read', label: 'Balance (Read)' },
  { value: 'usage:read', label: 'Usage (Read)' },
  { value: 'tokens:read', label: 'Tokens (Read)' },
  { value: 'tokens:write', label: 'Tokens (Write)' },
];

const GRANT_TYPES = [
  { value: 'authorization_code', label: 'Authorization Code' },
  { value: 'refresh_token', label: 'Refresh Token' },
  { value: 'client_credentials', label: 'Client Credentials' },
];

const EditOAuthClientModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingClient?.client_id !== undefined;
  const [newClientSecret, setNewClientSecret] = useState(null);

  const getInitValues = () => ({
    client_name: '',
    redirect_uris: '',
    scope: ['openid', 'profile', 'email', 'offline_access'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'client_secret_basic',
  });

  const handleCancel = () => {
    setNewClientSecret(null);
    props.handleClose();
  };

  const loadClient = async () => {
    if (!props.editingClient?.client_id) return;

    setLoading(true);
    try {
      // For edit mode, we populate from the passed data since the API returns list only
      const client = props.editingClient;
      if (formApiRef.current) {
        formApiRef.current.setValues({
          client_name: client.client_name || '',
          redirect_uris: Array.isArray(client.redirect_uris)
            ? client.redirect_uris.join('\n')
            : client.redirect_uris || '',
          scope: Array.isArray(client.scope)
            ? client.scope
            : (client.scope || '').split(' ').filter(Boolean),
          grant_types: client.grant_types || ['authorization_code', 'refresh_token'],
          token_endpoint_auth_method: client.token_endpoint_auth_method || 'client_secret_basic',
        });
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadClient();
      } else {
        formApiRef.current?.setValues(getInitValues());
      }
    } else {
      formApiRef.current?.reset();
      setNewClientSecret(null);
    }
  }, [props.visiable, props.editingClient?.client_id]);

  const submit = async (values) => {
    setLoading(true);

    // Parse redirect URIs from textarea (one per line)
    const redirectUris = values.redirect_uris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean);

    if (redirectUris.length === 0) {
      showError(t('请至少输入一个 Redirect URI'));
      setLoading(false);
      return;
    }

    const payload = {
      client_name: values.client_name,
      redirect_uris: redirectUris,
      scope: values.scope.join(' '),
      grant_types: values.grant_types,
      token_endpoint_auth_method: values.token_endpoint_auth_method,
      response_types: ['code'],
    };

    try {
      if (isEdit) {
        // Update existing client
        const res = await API.put(
          `/api/oauth/admin/clients/${props.editingClient.client_id}`,
          payload
        );
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('客户端更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(message);
        }
      } else {
        // Create new client
        const res = await API.post('/api/oauth/admin/clients', payload);
        const { success, message, data } = res.data;
        if (success) {
          // Show the client_secret in a modal (only shown once)
          if (data?.client_secret) {
            setNewClientSecret(data.client_secret);
            Modal.success({
              title: t('客户端创建成功！'),
              content: (
                <div>
                  <Paragraph>
                    {t('请妥善保管以下 Client Secret，此信息仅显示一次：')}
                  </Paragraph>
                  <div className='bg-gray-100 p-3 rounded-lg mt-2'>
                    <Text copyable strong>
                      {data.client_secret}
                    </Text>
                  </div>
                  <Paragraph type='warning' className='mt-2'>
                    {t('关闭此窗口后将无法再次查看 Client Secret')}
                  </Paragraph>
                </div>
              ),
              okText: t('我已保存'),
              onOk: () => {
                props.refresh();
                props.handleClose();
              },
            });
          } else {
            showSuccess(t('客户端创建成功！'));
            props.refresh();
            props.handleClose();
          }
        } else {
          showError(message);
        }
      }
    } catch (error) {
      showError(error.message || t('操作失败'));
    }

    setLoading(false);
  };

  return (
    <SideSheet
      placement={isEdit ? 'right' : 'left'}
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新 OAuth 客户端') : t('创建 OAuth 客户端')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={props.visiable}
      width={isMobile ? '100%' : 600}
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
              {t('提交')}
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
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              {/* Basic Info */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                    <IconKey size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置 OAuth 客户端的基本信息')}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='client_name'
                      label={t('客户端名称')}
                      placeholder={t('请输入客户端名称')}
                      rules={[{ required: true, message: t('请输入客户端名称') }]}
                      showClear
                    />
                  </Col>
                  {isEdit && props.editingClient?.client_id && (
                    <Col span={24}>
                      <Form.Slot label={t('Client ID')}>
                        <Text copyable>{props.editingClient.client_id}</Text>
                      </Form.Slot>
                    </Col>
                  )}
                </Row>
              </Card>

              {/* OAuth Settings */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='purple' className='mr-2 shadow-md'>
                    <IconLink size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('OAuth 设置')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('配置 OAuth 客户端的认证设置')}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.TextArea
                      field='redirect_uris'
                      label={t('Redirect URI')}
                      placeholder={t('请输入 Redirect URI，一行一个')}
                      rules={[{ required: true, message: t('请输入 Redirect URI') }]}
                      autosize
                      rows={3}
                      extraText={t('支持多个 URI，每行一个')}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='scope'
                      label={t('允许的 Scope')}
                      placeholder={t('请选择允许的 Scope')}
                      multiple
                      optionList={AVAILABLE_SCOPES}
                      rules={[{ required: true, message: t('请至少选择一个 Scope') }]}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='grant_types'
                      label={t('Grant Types')}
                      placeholder={t('请选择 Grant Types')}
                      multiple
                      optionList={GRANT_TYPES}
                      rules={[{ required: true, message: t('请至少选择一个 Grant Type') }]}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='token_endpoint_auth_method'
                      label={t('认证方式')}
                      placeholder={t('请选择认证方式')}
                      optionList={[
                        { value: 'client_secret_basic', label: 'Client Secret Basic' },
                        { value: 'client_secret_post', label: 'Client Secret Post' },
                        { value: 'none', label: t('公开客户端（无密钥）') },
                      ]}
                      rules={[{ required: true, message: t('请选择认证方式') }]}
                      style={{ width: '100%' }}
                      extraText={t('选择 "公开客户端" 将不会生成 Client Secret')}
                    />
                  </Col>
                </Row>
              </Card>
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditOAuthClientModal;
