import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Input, Button, Space, Select, Typography, Divider, Toast, TextArea } from '@douyinfe/semi-ui';
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

export default function OAuth2ToolsModal({ visible, onClose }) {
  const [server, setServer] = useState({});
  const [authURL, setAuthURL] = useState('');
  const [issuer, setIssuer] = useState('');
  const [confJSON, setConfJSON] = useState('');
  const [userinfoEndpoint, setUserinfoEndpoint] = useState('');
  const [code, setCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [idToken, setIdToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [tokenRaw, setTokenRaw] = useState('');
  const [jwtClaims, setJwtClaims] = useState('');
  const [userinfoOut, setUserinfoOut] = useState('');
  const [values, setValues] = useState({
    authorization_endpoint: '',
    token_endpoint: '',
    client_id: '',
    client_secret: '',
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
    if (!visible) return;
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
          setIssuer(d.issuer || '');
          setUserinfoEndpoint(d.userinfo_endpoint || '');
        }
      } catch {}
    })();
  }, [visible]);

  const buildAuthorizeURL = () => {
    const u = new URL(values.authorization_endpoint || (server.issuer + '/api/oauth/authorize'));
    const rt = values.response_type || 'code';
    u.searchParams.set('response_type', rt);
    u.searchParams.set('client_id', values.client_id);
    u.searchParams.set('redirect_uri', values.redirect_uri);
    u.searchParams.set('scope', values.scope);
    if (values.state) u.searchParams.set('state', values.state);
    if (values.nonce) u.searchParams.set('nonce', values.nonce);
    if (rt === 'code' && values.code_challenge) {
      u.searchParams.set('code_challenge', values.code_challenge);
      u.searchParams.set('code_challenge_method', values.code_challenge_method || 'S256');
    }
    return u.toString();
  };

  const copy = async (text, tip = '已复制') => {
    try { await navigator.clipboard.writeText(text); Toast.success(tip); } catch {}
  };

  const genVerifier = async () => {
    const v = randomString(64);
    const c = await sha256Base64Url(v);
    setValues((val) => ({ ...val, code_verifier: v, code_challenge: c }));
  };

  const discover = async () => {
    const iss = (issuer || '').trim();
    if (!iss) { Toast.warning('请填写 Issuer'); return; }
    try {
      const url = iss.replace(/\/$/, '') + '/api/.well-known/openid-configuration';
      const res = await fetch(url);
      const d = await res.json();
      setValues((v)=>({
        ...v,
        authorization_endpoint: d.authorization_endpoint || v.authorization_endpoint,
        token_endpoint: d.token_endpoint || v.token_endpoint,
      }));
      setUserinfoEndpoint(d.userinfo_endpoint || '');
      setIssuer(d.issuer || iss);
      setConfJSON(JSON.stringify(d, null, 2));
      Toast.success('已从发现文档加载端点');
    } catch (e) {
      Toast.error('自动发现失败');
    }
  };

  const parseConf = () => {
    try {
      const d = JSON.parse(confJSON || '{}');
      if (d.issuer) setIssuer(d.issuer);
      if (d.authorization_endpoint) setValues((v)=>({...v, authorization_endpoint: d.authorization_endpoint}));
      if (d.token_endpoint) setValues((v)=>({...v, token_endpoint: d.token_endpoint}));
      if (d.userinfo_endpoint) setUserinfoEndpoint(d.userinfo_endpoint);
      Toast.success('已解析配置并填充端点');
    } catch (e) {
      Toast.error('解析失败：' + e.message);
    }
  };

  const genConf = () => {
    const d = {
      issuer: issuer || undefined,
      authorization_endpoint: values.authorization_endpoint || undefined,
      token_endpoint: values.token_endpoint || undefined,
      userinfo_endpoint: userinfoEndpoint || undefined,
    };
    setConfJSON(JSON.stringify(d, null, 2));
  };

  async function postForm(url, data, basicAuth) {
    const body = Object.entries(data)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (basicAuth) headers['Authorization'] = 'Basic ' + btoa(`${basicAuth.id}:${basicAuth.secret}`);
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status} ${t}`);
    }
    return res.json();
  }

  const exchangeCode = async () => {
    try {
      const basic = values.client_secret ? { id: values.client_id, secret: values.client_secret } : undefined;
      const data = await postForm(values.token_endpoint, {
        grant_type: 'authorization_code',
        code: code.trim(),
        client_id: values.client_id,
        redirect_uri: values.redirect_uri,
        code_verifier: values.code_verifier,
      }, basic);
      setAccessToken(data.access_token || '');
      setIdToken(data.id_token || '');
      setRefreshToken(data.refresh_token || '');
      setTokenRaw(JSON.stringify(data, null, 2));
      Toast.success('已获取令牌');
    } catch (e) {
      Toast.error('兑换失败：' + e.message);
    }
  };

  const decodeIdToken = () => {
    const t = (idToken || '').trim();
    if (!t) { setJwtClaims('(空)'); return; }
    const parts = t.split('.');
    if (parts.length < 2) { setJwtClaims('格式错误'); return; }
    try {
      const json = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
      setJwtClaims(JSON.stringify(json, null, 2));
    } catch (e) {
      setJwtClaims('解码失败：' + e);
    }
  };

  const callUserInfo = async () => {
    if (!accessToken || !userinfoEndpoint) { Toast.warning('缺少 AccessToken 或 UserInfo 端点'); return; }
    try {
      const res = await fetch(userinfoEndpoint, { headers: { Authorization: 'Bearer ' + accessToken } });
      const data = await res.json();
      setUserinfoOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setUserinfoOut('调用失败：' + e);
    }
  };

  const doRefresh = async () => {
    if (!refreshToken) { Toast.warning('没有刷新令牌'); return; }
    try {
      const basic = values.client_secret ? { id: values.client_id, secret: values.client_secret } : undefined;
      const data = await postForm(values.token_endpoint, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: values.client_id,
      }, basic);
      setAccessToken(data.access_token || '');
      setIdToken(data.id_token || '');
      setRefreshToken(data.refresh_token || '');
      setTokenRaw(JSON.stringify(data, null, 2));
      Toast.success('刷新成功');
    } catch (e) {
      Toast.error('刷新失败：' + e.message);
    }
  };

  return (
    <Modal
      visible={visible}
      title='OAuth2 调试助手'
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={720}
      style={{ top: 48 }}
    >
      {/* Discovery */}
      <Typography.Title heading={6}>OIDC 发现</Typography.Title>
      <Form labelPosition='left' labelWidth={140} style={{ marginBottom: 8 }}>
        <Form.Input field='issuer' label='Issuer' placeholder='https://your-domain' value={issuer} onChange={setIssuer} />
      </Form>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={discover}>自动发现端点</Button>
        <Button onClick={genConf}>生成配置 JSON</Button>
        <Button onClick={parseConf}>解析配置 JSON</Button>
      </Space>
      <TextArea value={confJSON} onChange={setConfJSON} autosize={{ minRows: 3, maxRows: 8 }} placeholder='粘贴 /.well-known/openid-configuration JSON 或点击“生成配置 JSON”' />
      <Divider />

      {/* Authorization URL & PKCE */}
      <Typography.Title heading={6}>授权参数</Typography.Title>
      <Form labelPosition='left' labelWidth={140}>
        <Form.Select field='response_type' label='Response Type' value={values.response_type} onChange={(v)=>setValues({...values, response_type: v})}>
          <Select.Option value='code'>code</Select.Option>
          <Select.Option value='token'>token</Select.Option>
        </Form.Select>
        <Form.Input field='authorization_endpoint' label='Authorize URL' value={values.authorization_endpoint} onChange={(v)=>setValues({...values, authorization_endpoint: v})} />
        <Form.Input field='token_endpoint' label='Token URL' value={values.token_endpoint} onChange={(v)=>setValues({...values, token_endpoint: v})} />
        <Form.Input field='client_id' label='Client ID' placeholder='输入 client_id' value={values.client_id} onChange={(v)=>setValues({...values, client_id: v})} />
        <Form.Input field='client_secret' label='Client Secret（可选）' placeholder='留空表示公开客户端' value={values.client_secret} onChange={(v)=>setValues({...values, client_secret: v})} />
        <Form.Input field='redirect_uri' label='Redirect URI' value={values.redirect_uri} onChange={(v)=>setValues({...values, redirect_uri: v})} />
        <Form.Input field='scope' label='Scope' value={values.scope} onChange={(v)=>setValues({...values, scope: v})} />
        <Form.Select field='code_challenge_method' label='PKCE 方法' value={values.code_challenge_method} onChange={(v)=>setValues({...values, code_challenge_method: v})}>
          <Select.Option value='S256'>S256</Select.Option>
        </Form.Select>
        <Form.Input field='code_verifier' label='Code Verifier' value={values.code_verifier} onChange={(v)=>setValues({...values, code_verifier: v})} suffix={<Button size='small' onClick={genVerifier}>生成</Button>} />
        <Form.Input field='code_challenge' label='Code Challenge' value={values.code_challenge} onChange={(v)=>setValues({...values, code_challenge: v})} />
        <Form.Input field='state' label='State' value={values.state} onChange={(v)=>setValues({...values, state: v})} suffix={<Button size='small' onClick={()=>setValues({...values, state: randomString(16)})}>随机</Button>} />
        <Form.Input field='nonce' label='Nonce' value={values.nonce} onChange={(v)=>setValues({...values, nonce: v})} suffix={<Button size='small' onClick={()=>setValues({...values, nonce: randomString(16)})}>随机</Button>} />
      </Form>
      <Divider />
      <Space style={{ marginBottom: 8 }}>
        <Button onClick={()=>{ const url=buildAuthorizeURL(); setAuthURL(url); }}>生成授权链接</Button>
        <Button onClick={()=>window.open(buildAuthorizeURL(), '_blank')}>打开授权URL</Button>
        <Button onClick={()=>copy(buildAuthorizeURL(), '授权URL已复制')}>复制授权URL</Button>
        <Button onClick={()=>copy(JSON.stringify({
          authorize_url: values.authorization_endpoint,
          token_url: values.token_endpoint,
          client_id: values.client_id,
          redirect_uri: values.redirect_uri,
          scope: values.scope,
          response_type: values.response_type,
          code_challenge_method: values.code_challenge_method,
          code_verifier: values.code_verifier,
          code_challenge: values.code_challenge,
          state: values.state,
          nonce: values.nonce,
        }, null, 2), 'oauthdebugger参数已复制')}>复制 oauthdebugger 参数</Button>
        <Button onClick={()=>window.open('/oauth-demo.html', '_blank')}>打开前端 Demo</Button>
      </Space>
      <Form labelPosition='left' labelWidth={140}>
        <Form.TextArea field='authorize_url' label='授权链接' value={authURL} onChange={setAuthURL} rows={3} placeholder='(空)' />
        <div style={{ marginTop: 8 }}>
          <Button onClick={()=>copy(authURL, '授权URL已复制')}>复制当前授权URL</Button>
        </div>
      </Form>
      <Text type='tertiary' style={{ display: 'block', marginTop: 8 }}>
        提示：将上述参数粘贴到 oauthdebugger.com，或直接打开授权URL完成授权后回调。
      </Text>

      <Divider />
      {/* Token exchange */}
      <Typography.Title heading={6}>令牌操作</Typography.Title>
      <Form labelPosition='left' labelWidth={140}>
        <Form.Input field='code' label='授权码 (code)' value={code} onChange={setCode} placeholder='回调后粘贴 code' />
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Button type='primary' onClick={exchangeCode}>用 code 交换令牌</Button>
            <Button onClick={doRefresh}>使用 Refresh Token 刷新</Button>
          </Space>
        </div>
        <Form.Input field='access_token' label='Access Token' value={accessToken} onChange={setAccessToken} suffix={<Button size='small' onClick={()=>copy(accessToken,'AccessToken已复制')}>复制</Button>} />
        <Form.Input field='id_token' label='ID Token' value={idToken} onChange={setIdToken} suffix={<Button size='small' onClick={decodeIdToken}>解码</Button>} />
        <Form.Input field='refresh_token' label='Refresh Token' value={refreshToken} onChange={setRefreshToken} />
        <Form.TextArea field='token_raw' label='原始响应' value={tokenRaw} onChange={setTokenRaw} rows={3} placeholder='(空)' />
        <Form.TextArea field='jwt_claims' label='ID Token Claims' value={jwtClaims} onChange={setJwtClaims} rows={3} placeholder='(点击“解码”显示)'></Form.TextArea>
      </Form>

      <Divider />
      <Typography.Title heading={6}>UserInfo</Typography.Title>
      <Form labelPosition='left' labelWidth={140}>
        <Form.Input field='userinfo_endpoint' label='UserInfo URL' value={userinfoEndpoint} onChange={setUserinfoEndpoint} />
        <div style={{ marginTop: 8 }}>
          <Button onClick={callUserInfo}>调用 UserInfo (Bearer)</Button>
        </div>
        <Form.TextArea field='userinfo_out' label='返回' value={userinfoOut} onChange={setUserinfoOut} rows={3} placeholder='(空)'></Form.TextArea>
      </Form>
    </Modal>
  );
}
