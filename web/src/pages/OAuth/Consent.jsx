import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Typography, Tag, Space, Divider, Spin, Banner, Descriptions, Avatar, Tooltip } from '@douyinfe/semi-ui';
import { IconShield, IconTickCircle, IconClose } from '@douyinfe/semi-icons';
import { useLocation } from 'react-router-dom';
import { API, showError } from '../../helpers';

const { Title, Text, Paragraph } = Typography;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function OAuthConsent() {
  const query = useQuery();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const allowed = [
      'response_type',
      'client_id',
      'redirect_uri',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
      'nonce',
    ];
    const obj = {};
    allowed.forEach((k) => {
      const v = query.get(k);
      if (v) obj[k] = v;
    });
    if (!obj.response_type) obj.response_type = 'code';
    return obj;
  }, [query]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/oauth/authorize', {
          params: { ...params, mode: 'prepare' },
          // skip error toast, we'll handle gracefully
          skipErrorHandler: true,
        });
        setInfo(res.data);
        setError('');
      } catch (e) {
        // 401 login required or other error
        setError(e?.response?.data?.error || 'failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  const onApprove = () => {
    const u = new URL(window.location.origin + '/api/oauth/authorize');
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set('approve', '1');
    window.location.href = u.toString();
  };
  const onDeny = () => {
    const u = new URL(window.location.origin + '/api/oauth/authorize');
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set('deny', '1');
    window.location.href = u.toString();
  };

  const renderScope = () => {
    if (!info?.scope_info?.length) return (
      <div style={{ marginTop: 6 }}>
        {info?.scope_list?.map((s) => (
          <Tag key={s} style={{ marginRight: 6, marginBottom: 6 }}>{s}</Tag>
        ))}
      </div>
    );
    return (
      <div style={{ marginTop: 6 }}>
        {info.scope_info.map((s) => (
          <Tag key={s.Name} style={{ marginRight: 6, marginBottom: 6 }}>
            <Tooltip content={s.Description || s.Name}>{s.Name}</Tooltip>
          </Tag>
        ))}
      </div>
    );
  };

  const displayClient = () => (
    <div>
      <Space align='center' style={{ marginBottom: 6 }}>
        <Avatar size='small' style={{ backgroundColor: 'var(--semi-color-tertiary)' }}>
          {String(info?.client?.name || info?.client?.id || 'A').slice(0, 1).toUpperCase()}
        </Avatar>
        <Title heading={5} style={{ margin: 0 }}>{info?.client?.name || info?.client?.id}</Title>
        {info?.verified && <Tag type='solid' color='green'>已验证</Tag>}
        {info?.client?.type === 'public' && <Tag>公开客户端</Tag>}
        {info?.client?.type === 'confidential' && <Tag color='blue'>机密客户端</Tag>}
      </Space>
      {info?.client?.desc && (
        <Paragraph type='tertiary' style={{ marginTop: 0 }}>{info.client.desc}</Paragraph>
      )}
      <Descriptions size='small' style={{ marginTop: 8 }} data={[{
        key: '回调域名', value: info?.redirect_host || '-',
      }, {
        key: '申请方域', value: info?.client?.domain || '-',
      }, {
        key: '需要PKCE', value: info?.require_pkce ? '是' : '否',
      }]} />
    </div>
  );

  const displayUser = () => (
    <Space style={{ marginTop: 8 }}>
      <Avatar size='small'>{String(info?.user?.name || 'U').slice(0,1).toUpperCase()}</Avatar>
      <Text>{info?.user?.name || '当前用户'}</Text>
      {info?.user?.email && <Text type='tertiary'>({info.user.email})</Text>}
      <Button size='small' theme='borderless' onClick={() => {
        const u = new URL(window.location.origin + '/login');
        u.searchParams.set('next', '/oauth/consent' + window.location.search);
        window.location.href = u.toString();
      }}>切换账户</Button>
    </Space>
  );

  return (
    <div style={{ maxWidth: 840, margin: '24px auto 48px', padding: '0 16px' }}>
      <Card style={{ borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconShield size='extra-large' />
          <div>
            <Title heading={4} style={{ margin: 0 }}>应用请求访问你的账户</Title>
            <Paragraph type='tertiary' style={{ margin: 0 }}>请确认是否授权下列权限给第三方应用。</Paragraph>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin />
          </div>
        ) : error ? (
          <Banner type='warning' description={error === 'login_required' ? '请先登录后再继续授权。' : '暂时无法加载授权信息'} />
        ) : (
          info && (
            <div>
              <Divider margin='12px' />
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 16 }}>
                <div>
                  {displayClient()}
                  {displayUser()}
                  <div style={{ marginTop: 16 }}>
                    <Text type='tertiary'>请求的权限范围</Text>
                    {renderScope()}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Text type='tertiary'>回调地址</Text>
                    <Paragraph copyable style={{ marginTop: 4 }}>{info?.redirect_uri}</Paragraph>
                  </div>
                </div>
                <div>
                  <div style={{ background: 'var(--semi-color-fill-0)', border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12 }}>
                    <Text type='tertiary'>安全提示</Text>
                    <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                      <li>仅在信任的网络环境中授权。</li>
                      <li>确认回调域名与申请方一致{info?.verified ? '（已验证）' : '（未验证）'}。</li>
                      <li>你可以随时在账户设置中撤销授权。</li>
                    </ul>
                    <div style={{ marginTop: 12 }}>
                      <Descriptions size='small' data={[{
                        key: 'Issuer', value: window.location.origin,
                      }, {
                        key: 'Client ID', value: info?.client?.id || '-',
                      }, {
                        key: '需要PKCE', value: info?.require_pkce ? '是' : '否',
                      }]} />
                    </div>
                  </div>
                </div>
              </div>

              <Divider />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 8 }}>
                <Button icon={<IconClose />} onClick={onDeny} theme='borderless'>
                  拒绝
                </Button>
                <Button icon={<IconTickCircle />} type='primary' onClick={onApprove}>
                  授权
                </Button>
              </div>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
