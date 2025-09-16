import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Steps, Form, Input, Select, Switch, Typography, Space, Button, Tag, Toast } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

export default function OAuth2QuickStartModal({ visible, onClose, onDone }) {
  const origin = useMemo(() => window.location.origin, []);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step state
  const [enableOAuth, setEnableOAuth] = useState(true);
  const [issuer, setIssuer] = useState(origin);

  const [clientType, setClientType] = useState('public');
  const [redirect1, setRedirect1] = useState(origin + '/oauth/oidc');
  const [redirect2, setRedirect2] = useState('');
  const [scopes, setScopes] = useState(['openid', 'profile', 'email', 'api:read']);

  // Results
  const [createdClient, setCreatedClient] = useState(null);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      setLoading(false);
      setEnableOAuth(true);
      setIssuer(origin);
      setClientType('public');
      setRedirect1(origin + '/oauth/oidc');
      setRedirect2('');
      setScopes(['openid', 'profile', 'email', 'api:read']);
      setCreatedClient(null);
    }
  }, [visible, origin]);

  // 打开时读取现有配置作为默认值
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const res = await API.get('/api/option/');
        const { success, data } = res.data || {};
        if (!success || !Array.isArray(data)) return;
        const map = Object.fromEntries(data.map(i => [i.key, i.value]));
        if (typeof map['oauth2.enabled'] !== 'undefined') {
          setEnableOAuth(String(map['oauth2.enabled']).toLowerCase() === 'true');
        }
        if (map['oauth2.issuer']) {
          setIssuer(map['oauth2.issuer']);
        }
      } catch (_) {}
    })();
  }, [visible]);

  const applyRecommended = async () => {
    setLoading(true);
    try {
      const ops = [
        { key: 'oauth2.enabled', value: String(enableOAuth) },
        { key: 'oauth2.issuer', value: issuer || '' },
        { key: 'oauth2.allowed_grant_types', value: JSON.stringify(['authorization_code', 'refresh_token', 'client_credentials']) },
        { key: 'oauth2.require_pkce', value: 'true' },
        { key: 'oauth2.jwt_signing_algorithm', value: 'RS256' },
      ];
      for (const op of ops) {
        await API.put('/api/option/', op);
      }
      showSuccess('已应用推荐配置');
      setStep(1);
      onDone && onDone();
    } catch (e) {
      showError('应用推荐配置失败');
    } finally {
      setLoading(false);
    }
  };

  const rotateKey = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/rotate', {});
      if (res?.data?.success) {
        showSuccess('签名密钥已准备：' + res.data.kid);
      } else {
        showError(res?.data?.message || '签名密钥操作失败');
        return;
      }
      setStep(2);
    } catch (e) {
      showError('签名密钥操作失败');
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    setLoading(true);
    try {
      const grant_types = clientType === 'public' ? ['authorization_code', 'refresh_token'] : ['authorization_code', 'refresh_token', 'client_credentials'];
      const payload = {
        name: 'Default OIDC Client',
        client_type: clientType,
        grant_types,
        redirect_uris: [redirect1, redirect2].filter(Boolean),
        scopes,
        require_pkce: true,
      };
      const res = await API.post('/api/oauth_clients/', payload);
      if (res?.data?.success) {
        setCreatedClient({ id: res.data.client_id, secret: res.data.client_secret });
        showSuccess('客户端已创建');
        setStep(3);
      } else {
        showError(res?.data?.message || '创建失败');
      }
      onDone && onDone();
    } catch (e) {
      showError('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '应用推荐配置',
      content: (
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Form labelPosition='left' labelWidth={140}>
                <Form.Switch field='enable' label='启用 OAuth2 & SSO' checkedText='开' uncheckedText='关' checked={enableOAuth} onChange={setEnableOAuth} extraText='开启后将根据推荐设置完成授权链路' />
                <Form.Input field='issuer' label='发行人 (Issuer)' placeholder={origin} value={issuer} onChange={setIssuer} extraText='为空则按请求自动推断（含 X-Forwarded-Proto）' />
              </Form>
            </div>
            <div>
              <Text type='tertiary'>说明</Text>
              <div style={{ marginTop: 8 }}>
                <Tag>grant_types: auth_code / refresh_token / client_credentials</Tag>
                <Tag>PKCE: S256</Tag>
                <Tag>算法: RS256</Tag>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingBottom: 12 }}>
            <Button type='primary' onClick={applyRecommended} loading={loading}>一键应用</Button>
          </div>
        </div>
      )
    },
    {
      title: '准备签名密钥',
      content: (
        <div style={{ paddingTop: 8 }}>
          <Text type='tertiary'>若无密钥则初始化；如已存在建议立即轮换以生成新的 kid 并发布到 JWKS。</Text>
          <div style={{ marginTop: 12 }}>
            <Button type='primary' onClick={rotateKey} loading={loading}>初始化/轮换密钥</Button>
          </div>
        </div>
      )
    },
    {
      title: '创建默认 OIDC 客户端',
      content: (
        <div style={{ paddingTop: 8 }}>
          <Form labelPosition='left' labelWidth={120}>
            <Form.Select field='type' label='客户端类型' value={clientType} onChange={setClientType}>
              <Select.Option value='public'>公开客户端（SPA/移动端）</Select.Option>
              <Select.Option value='confidential'>机密客户端（服务端）</Select.Option>
            </Form.Select>
            <Form.Input field='r1' label='回调 URI 1' value={redirect1} onChange={setRedirect1} />
            <Form.Input field='r2' label='回调 URI 2' value={redirect2} onChange={setRedirect2} />
            <Form.Select field='scopes' label='Scopes' multiple value={scopes} onChange={setScopes}>
              <Select.Option value='openid'>openid</Select.Option>
              <Select.Option value='profile'>profile</Select.Option>
              <Select.Option value='email'>email</Select.Option>
              <Select.Option value='api:read'>api:read</Select.Option>
              <Select.Option value='api:write'>api:write</Select.Option>
              <Select.Option value='admin'>admin</Select.Option>
            </Form.Select>
          </Form>
          <div style={{ marginTop: 12 }}>
            <Button type='primary' onClick={createClient} loading={loading}>创建</Button>
          </div>
        </div>
      )
    },
    {
      title: '完成',
      content: (
        <div style={{ paddingTop: 8 }}>
          {createdClient ? (
            <div>
              <Text>客户端已创建：</Text>
              <div style={{ marginTop: 8 }}>
                <Text>Client ID：</Text> <Text code copyable>{createdClient.id}</Text>
              </div>
              {createdClient.secret && (
                <div style={{ marginTop: 8 }}>
                  <Text>Client Secret（仅此一次展示）：</Text> <Text code copyable>{createdClient.secret}</Text>
                </div>
              )}
            </div>
          ) : <Text type='tertiary'>已完成初始化。</Text>}
        </div>
      )
    }
  ];

  return (
    <Modal
      visible={visible}
      title='OAuth2 一键初始化向导'
      onCancel={onClose}
      footer={null}
      width={720}
      style={{ top: 48 }}
      maskClosable={false}
    >
      <Steps current={step} style={{ marginBottom: 16 }}>
        {steps.map((s, idx) => <Steps.Step key={idx} title={s.title} />)}
      </Steps>
      <div style={{ paddingLeft: 8, paddingRight: 8 }}>
        {steps[step].content}
      </div>
    </Modal>
  );
}
