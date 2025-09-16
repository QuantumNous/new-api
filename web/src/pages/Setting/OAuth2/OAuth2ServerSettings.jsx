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
import { Banner, Button, Col, Form, Row, Card } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function OAuth2ServerSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'oauth2.enabled': false,
    'oauth2.issuer': '',
    'oauth2.access_token_ttl': 10,
    'oauth2.refresh_token_ttl': 720,
    'oauth2.jwt_signing_algorithm': 'RS256',
    'oauth2.jwt_key_id': 'oauth2-key-1',
    'oauth2.jwt_private_key_file': '',
    'oauth2.allowed_grant_types': ['client_credentials', 'authorization_code', 'refresh_token'],
    'oauth2.require_pkce': true,
    'oauth2.auto_create_user': false,
    'oauth2.default_user_role': 1,
    'oauth2.default_user_group': 'default',
    'oauth2.max_jwks_keys': 3,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [keysReady, setKeysReady] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else if (Array.isArray(inputs[item.key])) {
        value = JSON.stringify(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        if (props && props.refresh) {
          props.refresh();
        }
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  // 测试OAuth2连接
  const testOAuth2 = async () => {
    try {
      const res = await API.get('/api/oauth/server-info');
      // 只要返回了issuer等关键字段即可视为成功
      if (res.status === 200 && (res.data.issuer || res.data.authorization_endpoint)) {
        showSuccess('OAuth2服务器运行正常');
      } else {
        showError('OAuth2服务器测试失败');
      }
    } catch (error) {
      showError('OAuth2服务器连接测试失败');
    }
  };

  useEffect(() => {
    if (props && props.options) {
      const currentInputs = {};
      for (let key in props.options) {
        if (Object.keys(inputs).includes(key)) {
          if (key === 'oauth2.allowed_grant_types') {
            try {
              currentInputs[key] = JSON.parse(props.options[key] || '["client_credentials","authorization_code","refresh_token"]');
            } catch {
              currentInputs[key] = ['client_credentials', 'authorization_code', 'refresh_token'];
            }
          } else if (typeof inputs[key] === 'boolean') {
            currentInputs[key] = props.options[key] === 'true';
          } else if (typeof inputs[key] === 'number') {
            currentInputs[key] = parseInt(props.options[key]) || inputs[key];
          } else {
            currentInputs[key] = props.options[key];
          }
        }
      }
      setInputs({...inputs, ...currentInputs});
      setInputsRow(structuredClone({...inputs, ...currentInputs}));
      if (refForm.current) {
        refForm.current.setValues({...inputs, ...currentInputs});
      }
    }
  }, [props]);

  useEffect(() => {
    const loadKeys = async () => {
      try {
        setKeysLoading(true);
        const res = await API.get('/api/oauth/keys', { skipErrorHandler: true });
        const list = res?.data?.data || [];
        setKeysReady(list.length > 0);
      } catch {
        setKeysReady(false);
      } finally {
        setKeysLoading(false);
      }
    };
    if (inputs['oauth2.enabled']) {
      loadKeys();
    }
  }, [inputs['oauth2.enabled']]);

  return (
    <div>
      {/* 移除重复的顶卡片，统一在下方“基础配置”中显示开关与 Issuer */}

      {/* 开关与基础配置 */}
      <Card style={{ marginTop: 10 }}>
        <Form
          initValues={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
        >
          <Form.Section text={'基础配置'}>
            {!keysReady && inputs['oauth2.enabled'] && (
              <Banner
                type='warning'
                description={<div>
                  <div>尚未准备签名密钥，建议立即初始化或轮换以发布 JWKS。</div>
                  <div>签名密钥用于 JWT 令牌的安全签发。</div>
                </div>}
                actions={<Button size='small' onClick={() => props?.onOpenJWKS && props.onOpenJWKS()} loading={keysLoading}>打开密钥向导</Button>}
                style={{ marginBottom: 12 }}
              />
            )}
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.Switch
                  field='oauth2.enabled'
                  label={t('启用 OAuth2 & SSO')}
                  checkedText='开'
                  uncheckedText='关'
                  value={inputs['oauth2.enabled']}
                  onChange={handleFieldChange('oauth2.enabled')}
                  extraText="开启后将允许以 OAuth2/OIDC 标准进行授权与登录"
                />
              </Col>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.Input
                  field='oauth2.issuer'
                  label={t('发行人 (Issuer)')}
                  placeholder={window.location.origin}
                  value={inputs['oauth2.issuer']}
                  onChange={handleFieldChange('oauth2.issuer')}
                  extraText="为空则按请求自动推断（含 X-Forwarded-Proto）"
                />
              </Col>
            </Row>
            <Button onClick={onSubmit} loading={loading}>{t('更新基础配置')}</Button>
          </Form.Section>
        </Form>
      </Card>

      {inputs['oauth2.enabled'] && (
      <>
      <Card style={{ marginTop: 10 }}>
        <Form
          initValues={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
        >
          <Form.Section text={'令牌配置'}>
            <Banner
              type='info'
              description={<div>
                <div>• OAuth2 服务器提供标准的 API 认证与授权</div>
                <div>• 支持 Client Credentials、Authorization Code + PKCE 等标准流程</div>
                <div>• 配置保存后多数项即时生效；签名密钥轮换与 JWKS 发布为即时操作；一般无需重启</div>
                <div>• 生产环境务必启用 HTTPS，并妥善管理 JWT 签名密钥</div>
              </div>}
              style={{ marginBottom: 12 }}
            />
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
              <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field='oauth2.access_token_ttl'
                  label={t('访问令牌有效期')}
                  suffix="分钟"
                  min={1}
                  max={1440}
                  value={inputs['oauth2.access_token_ttl']}
                  onChange={handleFieldChange('oauth2.access_token_ttl')}
                  extraText="访问令牌的有效时间，建议较短（10-60分钟）"
                />
              </Col>
              <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field='oauth2.refresh_token_ttl'
                  label={t('刷新令牌有效期')}
                  suffix="小时"
                  min={1}
                  max={8760}
                  value={inputs['oauth2.refresh_token_ttl']}
                  onChange={handleFieldChange('oauth2.refresh_token_ttl')}
                  extraText="刷新令牌的有效时间，建议较长（12-720小时）"
                />
              </Col>
              <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                <Form.Input
                  field='oauth2.jwt_key_id'
                  label={t('JWT密钥ID')}
                  placeholder="oauth2-key-1"
                  value={inputs['oauth2.jwt_key_id']}
                  onChange={handleFieldChange('oauth2.jwt_key_id')}
                  extraText="用于标识JWT签名密钥，支持密钥轮换"
                />
              </Col>
            </Row>
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.Select
                  field='oauth2.jwt_signing_algorithm'
                  label={t('JWT签名算法')}
                  value={inputs['oauth2.jwt_signing_algorithm']}
                  onChange={handleFieldChange('oauth2.jwt_signing_algorithm')}
                  extraText="JWT令牌的签名算法，推荐使用RS256"
                >
                  <Form.Select.Option value="RS256">RS256 (RSA with SHA-256)</Form.Select.Option>
                  <Form.Select.Option value="HS256">HS256 (HMAC with SHA-256)</Form.Select.Option>
                </Form.Select>
              </Col>
              {/*<Col xs={24} sm={24} md={12} lg={12} xl={12}>*/}
              {/*  <Form.Input*/}
              {/*    field='oauth2.jwt_private_key_file'*/}
              {/*    label={t('JWT私钥文件路径（可选）')}*/}
              {/*    placeholder="/path/to/oauth2-private-key.pem"*/}
              {/*    value={inputs['oauth2.jwt_private_key_file']}*/}
              {/*    onChange={handleFieldChange('oauth2.jwt_private_key_file')}*/}
              {/*    extraText="如需外部文件私钥，可在此指定路径；推荐使用内存密钥 + JWKS 轮换（更安全便捷）"*/}
              {/*  />*/}
              {/*</Col>*/}
            </Row>
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.InputNumber
                  field='oauth2.max_jwks_keys'
                  label='JWKS历史保留上限'
                  min={1}
                  max={10}
                  value={inputs['oauth2.max_jwks_keys']}
                  onChange={handleFieldChange('oauth2.max_jwks_keys')}
                  extraText="轮换后最多保留的历史签名密钥数量（越少越安全，建议 3）"
                />
              </Col>
            </Row>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={onSubmit} loading={loading}>{t('更新令牌配置')}</Button>
              <Button type='secondary' onClick={() => props && props.onOpenJWKS && props.onOpenJWKS()}>密钥向导（JWKS）</Button>
            </div>
          </Form.Section>
        </Form>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Form
          initValues={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
        >
          <Form.Section text={'授权配置'}>
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.Select
                  field='oauth2.allowed_grant_types'
                  label={t('允许的授权类型')}
                  multiple
                  value={inputs['oauth2.allowed_grant_types']}
                  onChange={handleFieldChange('oauth2.allowed_grant_types')}
                  extraText="选择允许的OAuth2授权流程"
                >
                  <Form.Select.Option value="client_credentials">Client Credentials（客户端凭证）</Form.Select.Option>
                  <Form.Select.Option value="authorization_code">Authorization Code（授权码）</Form.Select.Option>
                  <Form.Select.Option value="refresh_token">Refresh Token（刷新令牌）</Form.Select.Option>
                </Form.Select>
              </Col>
              <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                <Form.Switch
                  field='oauth2.require_pkce'
                  label={t('强制PKCE验证')}
                  checkedText='开'
                  uncheckedText='关'
                  value={inputs['oauth2.require_pkce']}
                  onChange={handleFieldChange('oauth2.require_pkce')}
                  extraText="为授权码流程强制启用PKCE，提高安全性"
                />
              </Col>
            </Row>
            <Button onClick={onSubmit} loading={loading}>{t('更新授权配置')}</Button>
          </Form.Section>
        </Form>
      </Card>

      {/*<Card style={{ marginTop: 10 }}>*/}
      {/*  <Form*/}
      {/*    initValues={inputs}*/}
      {/*    getFormApi={(formAPI) => (refForm.current = formAPI)}*/}
      {/*  >*/}
      {/*    <Form.Section text={'用户配置'}>*/}
      {/*      <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>*/}
      {/*        <Col xs={24} sm={24} md={8} lg={8} xl={8}>*/}
      {/*          <Form.Switch*/}
      {/*            field='oauth2.auto_create_user'*/}
      {/*            label={t('自动创建用户')}*/}
      {/*            checkedText='开'*/}
      {/*            uncheckedText='关'*/}
      {/*            value={inputs['oauth2.auto_create_user']}*/}
      {/*            onChange={handleFieldChange('oauth2.auto_create_user')}*/}
      {/*            extraText="首次OAuth2登录时自动创建用户账户"*/}
      {/*          />*/}
      {/*        </Col>*/}
      {/*        <Col xs={24} sm={24} md={8} lg={8} xl={8}>*/}
      {/*          <Form.Select*/}
      {/*            field='oauth2.default_user_role'*/}
      {/*            label={t('默认用户角色')}*/}
      {/*            value={inputs['oauth2.default_user_role']}*/}
      {/*            onChange={handleFieldChange('oauth2.default_user_role')}*/}
      {/*            extraText="自动创建用户时的默认角色"*/}
      {/*          >*/}
      {/*            <Form.Select.Option value={1}>普通用户</Form.Select.Option>*/}
      {/*            <Form.Select.Option value={10}>管理员</Form.Select.Option>*/}
      {/*            <Form.Select.Option value={100}>超级管理员</Form.Select.Option>*/}
      {/*          </Form.Select>*/}
      {/*        </Col>*/}
      {/*        <Col xs={24} sm={24} md={8} lg={8} xl={8}>*/}
      {/*          <Form.Input*/}
      {/*            field='oauth2.default_user_group'*/}
      {/*            label={t('默认用户分组')}*/}
      {/*            placeholder="default"*/}
      {/*            value={inputs['oauth2.default_user_group']}*/}
      {/*            onChange={handleFieldChange('oauth2.default_user_group')}*/}
      {/*            extraText="自动创建用户时的默认分组"*/}
      {/*          />*/}
      {/*        </Col>*/}
      {/*      </Row>*/}
      {/*      <Button onClick={onSubmit} loading={loading}>{t('更新用户配置')}</Button>*/}
      {/*      <Button*/}
      {/*        type="secondary"*/}
      {/*        onClick={testOAuth2}*/}
      {/*        style={{ marginLeft: 8 }}*/}
      {/*      >*/}
      {/*        {t('测试连接')}*/}
      {/*      </Button>*/}
      {/*    </Form.Section>*/}
      {/*  </Form>*/}
      {/*</Card>*/}
      </>
      )}
    </div>
  );
}
