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
  Banner,
  Button,
  Col,
  Form,
  Row,
  Card,
  Typography,
  Badge,
  Divider,
} from '@douyinfe/semi-ui';
import { Server } from 'lucide-react';
import JWKSManagerModal from './modals/JWKSManagerModal';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

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
    'oauth2.allowed_grant_types': [
      'client_credentials',
      'authorization_code',
      'refresh_token',
    ],
    'oauth2.require_pkce': true,
    'oauth2.max_jwks_keys': 3,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [keysReady, setKeysReady] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const enabledRef = useRef(inputs['oauth2.enabled']);

  // 模态框状态
  const [jwksVisible, setJwksVisible] = useState(false);

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

  // 测试OAuth2连接（默认静默，仅用户点击时弹提示）
  const testOAuth2 = async (silent = true) => {
    // 未启用时不触发测试，避免 404
    if (!enabledRef.current) return;
    try {
      const res = await API.get('/api/oauth/server-info', {
        skipErrorHandler: true,
      });
      if (!enabledRef.current) return;
      if (
        res.status === 200 &&
        (res.data.issuer || res.data.authorization_endpoint)
      ) {
        if (!silent) showSuccess('OAuth2服务器运行正常');
        setServerInfo(res.data);
      } else {
        if (!enabledRef.current) return;
        if (!silent) showError('OAuth2服务器测试失败');
      }
    } catch (error) {
      if (!enabledRef.current) return;
      if (!silent) showError('OAuth2服务器连接测试失败');
    }
  };

  useEffect(() => {
    if (props && props.options) {
      const currentInputs = {};
      for (let key in props.options) {
        if (Object.keys(inputs).includes(key)) {
          if (key === 'oauth2.allowed_grant_types') {
            try {
              currentInputs[key] = JSON.parse(
                props.options[key] ||
                  '["client_credentials","authorization_code","refresh_token"]',
              );
            } catch {
              currentInputs[key] = [
                'client_credentials',
                'authorization_code',
                'refresh_token',
              ];
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
      setInputs({ ...inputs, ...currentInputs });
      setInputsRow(structuredClone({ ...inputs, ...currentInputs }));
      if (refForm.current) {
        refForm.current.setValues({ ...inputs, ...currentInputs });
      }
    }
  }, [props]);

  useEffect(() => {
    enabledRef.current = inputs['oauth2.enabled'];
  }, [inputs['oauth2.enabled']]);

  useEffect(() => {
    const loadKeys = async () => {
      try {
        setKeysLoading(true);
        const res = await API.get('/api/oauth/keys', {
          skipErrorHandler: true,
        });
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
      testOAuth2(true);
    } else {
      // 禁用时清理状态，避免残留状态与不必要的请求
      setKeysReady(true);
      setServerInfo(null);
      setKeysLoading(false);
    }
  }, [inputs['oauth2.enabled']]);

  const isEnabled = inputs['oauth2.enabled'];

  return (
    <div>
      {/* OAuth2 服务端管理 */}
      <Card
        className='!rounded-2xl shadow-sm border-0'
        style={{ marginTop: 10 }}
        title={
          <div
            className='flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3 sm:gap-0'
            style={{ paddingRight: '8px' }}
          >
            <div className='flex items-center'>
              <Server size={18} className='mr-2' />
              <Text strong>{t('OAuth2 服务端管理')}</Text>
              {isEnabled ? (
                serverInfo ? (
                  <Badge
                    count={t('运行正常')}
                    type='success'
                    style={{ marginLeft: 8 }}
                  />
                ) : (
                  <Badge
                    count={t('配置中')}
                    type='warning'
                    style={{ marginLeft: 8 }}
                  />
                )
              ) : (
                <Badge
                  count={t('未启用')}
                  type='tertiary'
                  style={{ marginLeft: 8 }}
                />
              )}
            </div>
            <div className='flex items-center gap-2 sm:flex-shrink-0'>
              {isEnabled && (
                <Button
                  type='secondary'
                  onClick={() => setJwksVisible(true)}
                  size='small'
                >
                  {t('密钥管理')}
                </Button>
              )}
              <Button
                type='primary'
                onClick={onSubmit}
                loading={loading}
                size='small'
              >
                {t('保存配置')}
              </Button>
            </div>
          </div>
        }
      >
        <Form
          initValues={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
        >
          {!keysReady && isEnabled && (
            <Banner
              type='warning'
              className='!rounded-lg'
              closeIcon={null}
              description={t(
                '尚未准备签名密钥，建议立即初始化或轮换以发布 JWKS。签名密钥用于 JWT 令牌的安全签发。',
              )}
            />
          )}

          <Row gutter={[16, 24]}>
            <Col xs={24} lg={12}>
              <Form.Switch
                field='oauth2.enabled'
                label={t('启用 OAuth2 & SSO')}
                value={inputs['oauth2.enabled']}
                onChange={handleFieldChange('oauth2.enabled')}
                extraText={t('开启后将允许以 OAuth2/OIDC 标准进行授权与登录')}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Form.Input
                field='oauth2.issuer'
                label={t('发行人 (Issuer)')}
                placeholder={window.location.origin}
                value={inputs['oauth2.issuer']}
                onChange={handleFieldChange('oauth2.issuer')}
                extraText={t('为空则按请求自动推断（含 X-Forwarded-Proto）')}
              />
            </Col>
          </Row>

          {/* 令牌配置 */}
          <Divider margin='24px'>{t('令牌配置')}</Divider>

          <Row gutter={[16, 24]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.InputNumber
                field='oauth2.access_token_ttl'
                label={t('访问令牌有效期')}
                suffix={t('分钟')}
                min={1}
                max={1440}
                value={inputs['oauth2.access_token_ttl']}
                onChange={handleFieldChange('oauth2.access_token_ttl')}
                extraText={t('访问令牌的有效时间，建议较短（10-60分钟）')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.InputNumber
                field='oauth2.refresh_token_ttl'
                label={t('刷新令牌有效期')}
                suffix={t('小时')}
                min={1}
                max={8760}
                value={inputs['oauth2.refresh_token_ttl']}
                onChange={handleFieldChange('oauth2.refresh_token_ttl')}
                extraText={t('刷新令牌的有效时间，建议较长（12-720小时）')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.InputNumber
                field='oauth2.max_jwks_keys'
                label={t('JWKS历史保留上限')}
                min={1}
                max={10}
                value={inputs['oauth2.max_jwks_keys']}
                onChange={handleFieldChange('oauth2.max_jwks_keys')}
                extraText={t('轮换后最多保留的历史签名密钥数量')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              />
            </Col>
          </Row>

          <Row gutter={[16, 24]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Form.Select
                field='oauth2.jwt_signing_algorithm'
                label={t('JWT签名算法')}
                value={inputs['oauth2.jwt_signing_algorithm']}
                onChange={handleFieldChange('oauth2.jwt_signing_algorithm')}
                extraText={t('JWT令牌的签名算法，推荐使用RS256')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              >
                <Form.Select.Option value='RS256'>
                  RS256 (RSA with SHA-256)
                </Form.Select.Option>
                <Form.Select.Option value='HS256'>
                  HS256 (HMAC with SHA-256)
                </Form.Select.Option>
              </Form.Select>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Input
                field='oauth2.jwt_key_id'
                label={t('JWT密钥ID')}
                placeholder='oauth2-key-1'
                value={inputs['oauth2.jwt_key_id']}
                onChange={handleFieldChange('oauth2.jwt_key_id')}
                extraText={t('用于标识JWT签名密钥，支持密钥轮换')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              />
            </Col>
          </Row>

          {/* 授权配置 */}
          <Divider margin='24px'>{t('授权配置')}</Divider>

          <Row gutter={[16, 24]}>
            <Col xs={24} lg={12}>
              <Form.Select
                field='oauth2.allowed_grant_types'
                label={t('允许的授权类型')}
                multiple
                value={inputs['oauth2.allowed_grant_types']}
                onChange={handleFieldChange('oauth2.allowed_grant_types')}
                extraText={t('选择允许的OAuth2授权流程')}
                style={{
                  width: '100%',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                disabled={!isEnabled}
              >
                <Form.Select.Option value='client_credentials'>
                  {t('Client Credentials（客户端凭证）')}
                </Form.Select.Option>
                <Form.Select.Option value='authorization_code'>
                  {t('Authorization Code（授权码）')}
                </Form.Select.Option>
                <Form.Select.Option value='refresh_token'>
                  {t('Refresh Token（刷新令牌）')}
                </Form.Select.Option>
              </Form.Select>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Switch
                field='oauth2.require_pkce'
                label={t('强制PKCE验证')}
                value={inputs['oauth2.require_pkce']}
                onChange={handleFieldChange('oauth2.require_pkce')}
                extraText={t('为授权码流程强制启用PKCE，提高安全性')}
                disabled={!isEnabled}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 16 }}>
            <Text type='tertiary' size='small'>
              <div className='space-y-1'>
                <div>• {t('OAuth2 服务器提供标准的 API 认证与授权')}</div>
                <div>
                  •{' '}
                  {t(
                    '支持 Client Credentials、Authorization Code + PKCE 等标准流程',
                  )}
                </div>
                <div>
                  •{' '}
                  {t(
                    '配置保存后多数项即时生效；签名密钥轮换与 JWKS 发布为即时操作',
                  )}
                </div>
                <div>
                  • {t('生产环境务必启用 HTTPS，并妥善管理 JWT 签名密钥')}
                </div>
              </div>
            </Text>
          </div>
        </Form>
      </Card>

      {/* 模态框 */}
      <JWKSManagerModal
        visible={jwksVisible}
        onClose={() => setJwksVisible(false)}
      />
    </div>
  );
}
