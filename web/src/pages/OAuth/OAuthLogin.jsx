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

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Form, Spin, Tag } from '@douyinfe/semi-ui';
import { IconLock, IconMail } from '@douyinfe/semi-icons';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { useTranslation } from 'react-i18next';
import { API, getLogo, getSystemName, showError } from '../../helpers';

// Scope descriptions mapping
const SCOPE_DESCRIPTIONS = {
  openid: { name: '身份验证', desc: '验证您的身份', nameEn: 'Identity', descEn: 'Verify your identity' },
  profile: { name: '基本信息', desc: '访问您的用户名和头像', nameEn: 'Profile', descEn: 'Access your username and avatar' },
  email: { name: '邮箱地址', desc: '访问您的邮箱地址', nameEn: 'Email', descEn: 'Access your email address' },
  'balance:read': { name: '余额查看', desc: '查看您的账户余额', nameEn: 'Balance', descEn: 'View your account balance' },
  'usage:read': { name: '使用记录', desc: '查看您的 API 使用记录', nameEn: 'Usage', descEn: 'View your API usage records' },
  'tokens:read': { name: '令牌查看', desc: '查看您的 API 令牌列表', nameEn: 'Tokens (Read)', descEn: 'View your API token list' },
  'tokens:write': { name: '令牌管理', desc: '创建和删除 API 令牌', nameEn: 'Tokens (Write)', descEn: 'Create and delete API tokens' },
};

const OAuthLogin = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clientInfo, setClientInfo] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');

  const logo = getLogo();
  const systemName = getSystemName();
  const challenge = searchParams.get('login_challenge');
  const isEnglish = i18n.language === 'en';

  // Fetch client info on mount
  useEffect(() => {
    if (!challenge) {
      setError(t('缺少 login_challenge 参数'));
      setLoading(false);
      return;
    }

    const fetchClientInfo = async () => {
      try {
        const res = await API.get(`/api/oauth/login?login_challenge=${challenge}`);
        const { success, message, data } = res.data;

        if (success) {
          // Check if we need to redirect (already logged in)
          if (data.redirect_to) {
            window.location.href = data.redirect_to;
            return;
          }
          setClientInfo(data);
        } else {
          setError(message || t('获取客户端信息失败'));
        }
      } catch (err) {
        console.error('Failed to fetch client info:', err);
        setError(t('获取客户端信息失败'));
      } finally {
        setLoading(false);
      }
    };

    fetchClientInfo();
  }, [challenge, t]);

  // Handle login submission
  const handleSubmit = async () => {
    if (!username || !password) {
      showError(t('请输入用户名和密码'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.post('/api/oauth/login', {
        login_challenge: challenge,
        username,
        password,
      });

      const { success, message, data } = res.data;

      if (success) {
        if (data.require_2fa) {
          setRequire2FA(true);
        } else if (data.redirect_to) {
          window.location.href = data.redirect_to;
        }
      } else {
        showError(message || t('登录失败'));
      }
    } catch (err) {
      console.error('Login failed:', err);
      showError(t('登录失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle 2FA submission
  const handle2FASubmit = async () => {
    if (!twoFACode) {
      showError(t('请输入验证码'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.post('/api/oauth/login/2fa', {
        login_challenge: challenge,
        code: twoFACode,
      });

      const { success, message, data } = res.data;

      if (success && data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        showError(message || t('验证失败'));
      }
    } catch (err) {
      console.error('2FA verification failed:', err);
      showError(t('验证失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  // Get scope display name
  const getScopeName = (scope) => {
    const info = SCOPE_DESCRIPTIONS[scope];
    if (info) {
      return isEnglish ? info.nameEn : info.name;
    }
    return scope;
  };

  // Render loading state
  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-100'>
        <Spin size='large' />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-100'>
        <Card className='max-w-md w-full mx-4 !rounded-2xl'>
          <div className='text-center py-8'>
            <Title heading={4} className='text-red-500 mb-4'>
              {t('错误')}
            </Title>
            <Text>{error}</Text>
          </div>
        </Card>
      </div>
    );
  }

  // Render 2FA form
  if (require2FA) {
    return (
      <div className='relative overflow-hidden bg-gray-100 flex items-center justify-center min-h-screen py-12 px-4'>
        <div className='blur-ball blur-ball-indigo' style={{ top: '-80px', right: '-80px' }} />
        <div className='blur-ball blur-ball-teal' style={{ top: '50%', left: '-120px' }} />

        <div className='w-full max-w-md'>
          <div className='flex items-center justify-center mb-6 gap-2'>
            <img src={logo} alt='Logo' className='h-10 rounded-full' />
            <Title heading={3}>{systemName}</Title>
          </div>

          <Card className='border-0 !rounded-2xl overflow-hidden'>
            <div className='flex justify-center pt-6 pb-2'>
              <Title heading={3} className='text-gray-800 dark:text-gray-200'>
                {t('两步验证')}
              </Title>
            </div>
            <div className='px-4 py-8'>
              <Text className='block text-center mb-6 text-gray-600'>
                {t('请输入您的验证器应用中的验证码')}
              </Text>

              <Form className='space-y-4'>
                <Form.Input
                  field='code'
                  label={t('验证码')}
                  placeholder={t('请输入6位验证码')}
                  value={twoFACode}
                  onChange={setTwoFACode}
                  maxLength={6}
                />

                <Button
                  theme='solid'
                  type='primary'
                  className='w-full !rounded-full'
                  onClick={handle2FASubmit}
                  loading={submitting}
                >
                  {t('验证')}
                </Button>

                <Button
                  theme='borderless'
                  type='tertiary'
                  className='w-full'
                  onClick={() => {
                    setRequire2FA(false);
                    setTwoFACode('');
                  }}
                >
                  {t('返回登录')}
                </Button>
              </Form>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Render login form
  return (
    <div className='relative overflow-hidden bg-gray-100 flex items-center justify-center min-h-screen py-12 px-4'>
      <div className='blur-ball blur-ball-indigo' style={{ top: '-80px', right: '-80px' }} />
      <div className='blur-ball blur-ball-teal' style={{ top: '50%', left: '-120px' }} />

      <div className='w-full max-w-md'>
        <div className='flex items-center justify-center mb-6 gap-2'>
          <img src={logo} alt='Logo' className='h-10 rounded-full' />
          <Title heading={3}>{systemName}</Title>
        </div>

        <Card className='border-0 !rounded-2xl overflow-hidden'>
          <div className='flex flex-col items-center pt-6 pb-2'>
            <Title heading={4} className='text-gray-800 dark:text-gray-200'>
              {clientInfo?.client_name || t('第三方应用')}
            </Title>
            <Text className='text-gray-500 mt-2'>
              {t('请求访问您的账户')}
            </Text>
          </div>

          <div className='px-4 py-6'>
            <Form className='space-y-4'>
              <Form.Input
                field='username'
                label={t('用户名或邮箱')}
                placeholder={t('请输入您的用户名或邮箱地址')}
                value={username}
                onChange={setUsername}
                prefix={<IconMail />}
              />

              <Form.Input
                field='password'
                label={t('密码')}
                placeholder={t('请输入您的密码')}
                mode='password'
                value={password}
                onChange={setPassword}
                prefix={<IconLock />}
              />

              <Button
                theme='solid'
                type='primary'
                className='w-full !rounded-full'
                onClick={handleSubmit}
                loading={submitting}
              >
                {t('登录')}
              </Button>
            </Form>

            {clientInfo?.requested_scope && clientInfo.requested_scope.length > 0 && (
              <div className='mt-6 pt-4 border-t border-gray-200'>
                <Text className='text-sm text-gray-500 block mb-3'>
                  {t('登录后，该应用将获得以下权限：')}
                </Text>
                <div className='flex flex-wrap gap-2'>
                  {clientInfo.requested_scope.map((scope) => (
                    <Tag key={scope} color='blue' size='small'>
                      {getScopeName(scope)}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OAuthLogin;
