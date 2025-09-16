import React, { useMemo, useState } from 'react';
import { Card, Typography, Button, Space, Steps, Form, Input, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';

const { Title, Text } = Typography;

export default function OAuth2QuickStart({ onChanged }) {
  const [busy, setBusy] = useState(false);
  const origin = useMemo(() => window.location.origin, []);
  const [client, setClient] = useState({
    name: 'Default OIDC Client',
    client_type: 'public',
    redirect_uris: [origin + '/oauth/oidc', ''],
    scopes: ['openid', 'profile', 'email', 'api:read'],
  });

  const applyRecommended = async () => {
    setBusy(true);
    try {
      const ops = [
        { key: 'oauth2.enabled', value: 'true' },
        { key: 'oauth2.issuer', value: origin },
        { key: 'oauth2.allowed_grant_types', value: JSON.stringify(['authorization_code', 'refresh_token', 'client_credentials']) },
        { key: 'oauth2.require_pkce', value: 'true' },
        { key: 'oauth2.jwt_signing_algorithm', value: 'RS256' },
      ];
      for (const op of ops) {
        await API.put('/api/option/', op);
      }
      showSuccess('已应用推荐配置');
      onChanged && onChanged();
    } catch (e) {
      showError('应用推荐配置失败');
    } finally {
      setBusy(false);
    }
  };

  const ensureKey = async () => {
    setBusy(true);
    try {
      const res = await API.get('/api/oauth/keys');
      const list = res?.data?.data || [];
      if (list.length === 0) {
        const r = await API.post('/api/oauth/keys/rotate', {});
        if (r?.data?.success) showSuccess('已初始化签名密钥');
      } else {
        const r = await API.post('/api/oauth/keys/rotate', {});
        if (r?.data?.success) showSuccess('已轮换签名密钥：' + r.data.kid);
      }
    } catch (e) {
      showError('签名密钥操作失败');
    } finally {
      setBusy(false);
    }
  };

  const createClient = async () => {
    setBusy(true);
    try {
      const grant_types = client.client_type === 'public'
        ? ['authorization_code', 'refresh_token']
        : ['authorization_code', 'refresh_token', 'client_credentials'];
      const payload = {
        name: client.name,
        client_type: client.client_type,
        grant_types,
        redirect_uris: client.redirect_uris.filter(Boolean),
        scopes: client.scopes,
        require_pkce: true,
      };
      const res = await API.post('/api/oauth_clients/', payload);
      if (res?.data?.success) {
        Toast.success('客户端已创建：' + res.data.client_id);
        onChanged && onChanged();
      } else {
        showError(res?.data?.message || '创建失败');
      }
    } catch (e) {
      showError('创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginTop: 10 }}>
      <Title heading={5} style={{ marginBottom: 8 }}>OAuth2 一键初始化</Title>
      <Text type='tertiary'>按顺序完成以下步骤，系统将自动完成推荐设置、签名密钥准备、客户端创建与回调配置。</Text>
      <div style={{ marginTop: 12 }}>
        <Steps current={-1} type='basic' direction='vertical'>
          <Steps.Step title='应用推荐配置' description='启用 OAuth2，设置发行人(Issuer)为当前域名，启用授权码+PKCE、刷新令牌、客户端凭证。'>
            <Button onClick={applyRecommended} loading={busy} style={{ marginTop: 8 }}>一键应用</Button>
            <div style={{ marginTop: 8 }}>
              <Tag>issuer = {origin}</Tag>{' '}
              <Tag>grant_types = auth_code / refresh_token / client_credentials</Tag>{' '}
              <Tag>PKCE = S256</Tag>
            </div>
          </Steps.Step>
          <Steps.Step title='准备签名密钥' description='若无密钥则初始化；如已存在，建议立即轮换以生成新的 kid。'>
            <Button onClick={ensureKey} loading={busy} style={{ marginTop: 8 }}>初始化/轮换</Button>
          </Steps.Step>
          <Steps.Step title='创建 OIDC 客户端' description='创建一个默认客户端，预置常用回调与 scope，可直接用于调试与集成。'>
            <Form labelPosition='left' labelWidth={120} style={{ marginTop: 8 }}>
              <Form.Input label='名称' value={client.name} onChange={(v)=>setClient({...client, name: v})} />
              <Form.Select label='类型' value={client.client_type} onChange={(v)=>setClient({...client, client_type: v})}>
                <Select.Option value='public'>公开客户端</Select.Option>
                <Select.Option value='confidential'>机密客户端</Select.Option>
              </Form.Select>
              <Form.Input label='回调 URI 1' value={client.redirect_uris[0]} onChange={(v)=>{
                const arr=[...client.redirect_uris]; arr[0]=v; setClient({...client, redirect_uris: arr});
              }} />
              <Form.Input label='回调 URI 2' value={client.redirect_uris[1]} onChange={(v)=>{
                const arr=[...client.redirect_uris]; arr[1]=v; setClient({...client, redirect_uris: arr});
              }} />
              <Form.Select label='Scopes' multiple value={client.scopes} onChange={(v)=>setClient({...client, scopes: v})}>
                <Select.Option value='openid'>openid</Select.Option>
                <Select.Option value='profile'>profile</Select.Option>
                <Select.Option value='email'>email</Select.Option>
                <Select.Option value='api:read'>api:read</Select.Option>
                <Select.Option value='api:write'>api:write</Select.Option>
                <Select.Option value='admin'>admin</Select.Option>
              </Form.Select>
            </Form>
            <Button type='primary' onClick={createClient} loading={busy} style={{ marginTop: 8 }}>创建默认客户端</Button>
          </Steps.Step>
        </Steps>
      </div>
    </Card>
  );
}
