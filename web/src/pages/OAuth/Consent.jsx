import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Typography, Spin, Banner, Avatar, Divider, Popover } from '@douyinfe/semi-ui';
import { Link, Dot, Key, User, Mail, Eye, Pencil, Shield } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, getLogo } from '../../helpers';
import { stringToColor } from '../../helpers/render';

const { Title, Text } = Typography;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// 获取scope对应的图标
function getScopeIcon(scopeName) {
  switch (scopeName) {
    case 'openid':
      return Key;
    case 'profile':
      return User;
    case 'email':
      return Mail;
    case 'api:read':
      return Eye;
    case 'api:write':
      return Pencil;
    case 'admin':
      return Shield;
    default:
      return Dot;
  }
}

// 权限项组件
function ScopeItem({ name, description }) {
  const Icon = getScopeIcon(name);

  return (
    <div className='flex items-start gap-3 py-2'>
      <div className='w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
        <Icon size={24} />
      </div>
      <div className='flex-1 min-w-0'>
        <Text strong className='block'>
          {name}
        </Text>
        {description && (
          <Text type='tertiary' size='small' className='block mt-1'>
            {description}
          </Text>
        )}
      </div>
    </div>
  );
}

export default function OAuthConsent() {
  const { t } = useTranslation();
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

  const handleAction = (action) => {
    const u = new URL(window.location.origin + '/api/oauth/authorize');
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set(action, '1');
    window.location.href = u.toString();
  };

  return (
    <div className='min-h-screen flex items-center justify-center px-4'>
      <div className='w-full max-w-lg'>
        {loading ? (
          <Card className='text-center py-8'>
            <Spin size='large' />
            <Text type='tertiary' className='block mt-4'>{t('加载授权信息中...')}</Text>
          </Card>
        ) : error ? (
          <Card>
            <Banner
              type='warning'
              description={error === 'login_required' ? t('请先登录后再继续授权。') : t('暂时无法加载授权信息')}
            />
          </Card>
        ) : (
          info && (
            <>
              <Card
                className='!rounded-2xl border-0'
                footer={
                  <div className='space-y-3'>
                    <div className='flex gap-2'>
                      <Button
                        theme='outline'
                        onClick={() => handleAction('deny')}
                        className='w-full'
                      >
                        {t('取消')}
                      </Button>
                      <Button
                        type='primary'
                        theme='solid'
                        onClick={() => handleAction('approve')}
                        className='w-full'
                      >
                        {t('授权')} {info?.user?.name || t('用户')}
                      </Button>
                    </div>
                    <div className='text-center'>
                      <Text type='tertiary' size='small' className='block'>
                        {t('授权后将重定向到')}
                      </Text>
                      <Text type='tertiary' size='small' className='block'>
                        {info?.redirect_uri?.length > 60 ? info.redirect_uri.slice(0, 60) + '...' : info?.redirect_uri}
                      </Text>
                    </div>
                  </div>
                }
              >
                {/* 头部：应用 → 链接 → 站点Logo */}
                <div className='text-center py-8'>
                  <div className='flex items-center justify-center gap-6 mb-6'>
                    {/* 应用图标 */}
                    <Popover
                      content={
                        <div className='max-w-xs p-2'>
                          <Text strong className='block text-sm mb-1'>
                            {info?.client?.name || info?.client?.id}
                          </Text>
                          {info?.client?.desc && (
                            <Text type='tertiary' size='small' className='block'>
                              {info.client.desc}
                            </Text>
                          )}
                          {info?.client?.domain && (
                            <Text type='tertiary' size='small' className='block mt-1'>
                              {t('域名')}: {info.client.domain}
                            </Text>
                          )}
                        </div>
                      }
                      trigger='hover'
                      position='top'
                    >
                      <Avatar
                        size={36}
                        style={{
                          backgroundColor: stringToColor(info?.client?.name || info?.client?.id || 'A'),
                          cursor: 'pointer'
                        }}
                      >
                        {String(info?.client?.name || info?.client?.id || 'A').slice(0, 1).toUpperCase()}
                      </Avatar>
                    </Popover>
                    {/* 链接图标 */}
                    <div className='w-10 h-10 rounded-full flex items-center justify-center'>
                      <Link size={16} />
                    </div>
                    {/* 站点Logo */}
                    <div className='w-12 h-12 rounded-full overflow-hidden flex items-center justify-center'>
                      <img
                        src={getLogo()}
                        alt='Site Logo'
                        className='w-full h-full object-cover'
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div
                        className='w-full h-full rounded-full flex items-center justify-center'
                        style={{
                          backgroundColor: stringToColor(window.location.hostname || 'S'),
                          display: 'none'
                        }}
                      >
                        <Text className='font-bold text-lg'>
                          {window.location.hostname.charAt(0).toUpperCase()}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <Title heading={4}>
                    {t('授权')} {info?.client?.name || info?.client?.id}
                  </Title>
                </div>

                <Divider margin='0' />

                {/* 用户信息 */}
                <div className='px-5 py-3'>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-start gap-3'>
                      <div className='flex-1 min-w-0'>
                        <Text className='block'>
                          <Text strong>{info?.client?.name || info?.client?.id}</Text>
                          {' '}{t('由')}{' '}
                          <Text strong>{info?.client?.domain || t('未知域')}</Text>
                        </Text>
                        <Text type='tertiary' size='small' className='block mt-1'>
                          {t('想要访问你的')} <Text strong>{info?.user?.name || ''}</Text> {t('账户')}
                        </Text>
                      </div>
                    </div>
                    <Button size='small' theme='outline' type='tertiary' onClick={() => {
                      const u = new URL(window.location.origin + '/login');
                      u.searchParams.set('next', '/oauth/consent' + window.location.search);
                      window.location.href = u.toString();
                    }}>
                      {t('切换账户')}
                    </Button>
                  </div>
                </div>

                <Divider margin='0' />

                {/* 权限列表 */}
                <div className='px-5 py-3'>
                  <div className='space-y-2'>
                    {info?.scope_info?.length ? (
                      info.scope_info.map((scope) => (
                        <ScopeItem
                          key={scope.Name}
                          name={scope.Name}
                          description={scope.Description}
                        />
                      ))
                    ) : (
                      <div className='space-y-1'>
                        {info?.scope_list?.map((name) => (
                          <ScopeItem key={name} name={name} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Meta信息Card */}
              <Card bordered={false}>
                <div className='text-center'>
                  <div className='flex flex-wrap justify-center gap-x-2 gap-y-1 items-center'>
                    <Text size='small'>{t('客户端ID')}: {info?.client?.id?.slice(-8) || 'N/A'}</Text>
                    <Dot size={16} />
                    <Text size='small'>{t('类型')}: {info?.client?.type === 'public' ? t('公开应用') : t('机密应用')}</Text>
                    {info?.response_type && (
                      <>
                        <Dot size={16} />
                        <Text size='small'>{t('授权类型')}: {info.response_type === 'code' ? t('授权码') : info.response_type}</Text>
                      </>
                    )}
                    {info?.require_pkce && (
                      <>
                        <Dot size={16} />
                        <Text size='small'>PKCE: {t('已启用')}</Text>
                      </>
                    )}
                  </div>
                  {info?.state && (
                    <div className='mt-2'>
                      <Text type='tertiary' size='small' className='font-mono'>
                        State: {info.state}
                      </Text>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )
        )}
      </div>
    </div>
  );
}
