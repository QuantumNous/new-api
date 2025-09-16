import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, Toast, Select } from '@douyinfe/semi-ui';
import { API } from '../../../helpers';

const { Text } = Typography;

async function sha256Base64Url(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 43) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let res = '';
  const array = new Uint32Array(len);
  crypto.getRandomValues(array);
  for (let i = 0; i < len; i++) res += charset[array[i] % charset.length];
  return res;
}

export default function OAuth2Tools() {
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState({});
  const [values, setValues] = useState({
    authorization_endpoint: '',
    token_endpoint: '',
    client_id: '',
    redirect_uri: window.location.origin + '/oauth/oidc',
    scope: 'openid profile email',
    response_type: 'code',
    code_verifier: '',
    code_challenge: '',
    code_challenge_method: 'S256',
    state: '',
    nonce: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/oauth/server-info');
        if (res?.data) {
          const d = res.data;
          setServer(d);
          setValues((v) => ({
            ...v,
            authorization_endpoint: d.authorization_endpoint,
            token_endpoint: d.token_endpoint,
          }));
        }
      } catch {}
    })();
  }, []);

  const buildAuthorizeURL = () => {
    const u = new URL(values.authorization_endpoint || (server.issuer + '/oauth/authorize'));
    u.searchParams.set('response_type', values.response_type || 'code');
    u.searchParams.set('client_id', values.client_id);
    u.searchParams.set('redirect_uri', values.redirect_uri);
    u.searchParams.set('scope', values.scope);
    if (values.state) u.searchParams.set('state', values.state);
    if (values.nonce) u.searchParams.set('nonce', values.nonce);
    if (values.code_challenge) {
      u.searchParams.set('code_challenge', values.code_challenge);
      u.searchParams.set('code_challenge_method', values.code_challenge_method || 'S256');
    }
    return u.toString();
  };

  const copy = async (text, tip = '已复制') => {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(tip);
    } catch {}
  };

  const genVerifier = async () => {
    const v = randomString(64);
    const c = await sha256Base64Url(v);
    setValues((val) => ({ ...val, code_verifier: v, code_challenge: c }));
  };

  return (
    <Card style={{ marginTop: 10 }} title='OAuth2 调试助手'>
      <Form labelPosition='left' labelWidth={140}>
        <Form.Input field='authorization_endpoint' label='Authorize URL' value={values.authorization_endpoint} onChange={(v)=>setValues({...values, authorization_endpoint: v})} />
        <Form.Input field='token_endpoint' label='Token URL' value={values.token_endpoint} onChange={(v)=>setValues({...values, token_endpoint: v})} />
        <Form.Input field='client_id' label='Client ID' placeholder='输入 client_id' value={values.client_id} onChange={(v)=>setValues({...values, client_id: v})} />
        <Form.Input field='redirect_uri' label='Redirect URI' value={values.redirect_uri} onChange={(v)=>setValues({...values, redirect_uri: v})} />
        <Form.Input field='scope' label='Scope' value={values.scope} onChange={(v)=>setValues({...values, scope: v})} />
        <Form.Select field='code_challenge_method' label='PKCE 方法' value={values.code_challenge_method} onChange={(v)=>setValues({...values, code_challenge_method: v})}>
          <Select.Option value='S256'>S256</Select.Option>
        </Form.Select>
        <Form.Input field='code_verifier' label='Code Verifier' value={values.code_verifier} onChange={(v)=>setValues({...values, code_verifier: v})} suffix={
          <Button size='small' onClick={genVerifier}>生成</Button>
        } />
        <Form.Input field='code_challenge' label='Code Challenge' value={values.code_challenge} onChange={(v)=>setValues({...values, code_challenge: v})} />
        <Form.Input field='state' label='State' value={values.state} onChange={(v)=>setValues({...values, state: v})} suffix={<Button size='small' onClick={()=>setValues({...values, state: randomString(16)})}>随机</Button>} />
        <Form.Input field='nonce' label='Nonce' value={values.nonce} onChange={(v)=>setValues({...values, nonce: v})} suffix={<Button size='small' onClick={()=>setValues({...values, nonce: randomString(16)})}>随机</Button>} />
      </Form>
      <Divider />
      <Space>
        <Button onClick={()=>window.open(buildAuthorizeURL(), '_blank')}>打开授权URL</Button>
        <Button onClick={()=>copy(buildAuthorizeURL(), '授权URL已复制')}>复制授权URL</Button>
        <Button onClick={()=>copy(JSON.stringify({
          authorize_url: values.authorization_endpoint,
          token_url: values.token_endpoint,
          client_id: values.client_id,
          redirect_uri: values.redirect_uri,
          scope: values.scope,
          code_challenge_method: values.code_challenge_method,
          code_verifier: values.code_verifier,
          code_challenge: values.code_challenge,
          state: values.state,
          nonce: values.nonce,
        }, null, 2), 'oauthdebugger参数已复制')}>复制 oauthdebugger 参数</Button>
      </Space>
      <Text type='tertiary' style={{ display: 'block', marginTop: 8 }}>
        提示：将上述参数粘贴到 oauthdebugger.com，或直接打开授权URL完成授权后回调。
      </Text>
    </Card>
  );
}

