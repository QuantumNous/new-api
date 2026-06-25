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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getOAuthProviderIcon,
  setUserData,
  onGitHubOAuthClicked,
  onDiscordOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onCustomOAuthClicked,
  prepareCredentialRequestOptions,
  buildAssertionResult,
  isPasskeySupported,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Icon,
  Modal,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';
import AuthLayout from './AuthLayout';

import {
  IconGithubLogo,
  IconMail,
  IconLock,
  IconKey,
} from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const LoginForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    phone: '',
    sms_verification_code: '',
    wechat_verification_code: '',
  });
  const { username, password, phone, sms_verification_code } = inputs;
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showSmsLoginModal, setShowSmsLoginModal] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsCodeLoading, setSmsCodeLoading] = useState(false);
  const [smsLoginLoading, setSmsLoginLoading] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [otherLoginOptionsLoading, setOtherLoginOptionsLoading] =
    useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try {
      return JSON.parse(savedStatus) || {};
    } catch (err) {
      return {};
    }
  }, [statusState?.status]);
  const hasCustomOAuthProviders =
    (status.custom_oauth_providers || []).length > 0;
  const hasOAuthLoginOptions = Boolean(
    status.github_oauth ||
    status.discord_oauth ||
    status.oidc_enabled ||
    status.wechat_login ||
    status.sms_login ||
    status.linuxdo_oauth ||
    status.telegram_oauth ||
    hasCustomOAuthProviders,
  );
  const authHighlights = [
    {
      title: t('统一入口'),
      description: t('一个账号即可访问控制台、充值、令牌和模型广场。'),
    },
    {
      title: t('更快登录'),
      description: t('支持邮箱、OAuth、Passkey、Telegram 等多种方式。'),
    },
    {
      title: t('安全校验'),
      description: t('Turnstile、2FA 与协议确认会按站点配置自动启用。'),
    },
  ];

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }

    // 从 status 获取用户协议和隐私政策的启用状态
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    isPasskeySupported()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false));

    return () => {
      if (githubTimeoutRef.current) {
        clearTimeout(githubTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('未登录或登录已过期，请重新登录'));
    }
  }, []);

  useEffect(() => {
    if (smsCountdown <= 0) return;
    const timer = setTimeout(() => {
      setSmsCountdown((countdown) => countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [smsCountdown]);

  const onWeChatLoginClicked = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setWechatLoading(true);
    setShowWeChatLoginModal(true);
    setWechatLoading(false);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(
        `/api/oauth/wechat?code=${inputs.wechat_verification_code}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        setUserData(data);
        updateAPI();
        navigate('/');
        showSuccess(t('登录成功！'));
        setShowWeChatLoginModal(false);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('登录失败，请重试'));
    } finally {
      setWechatCodeSubmitLoading(false);
    }
  };

  const onSmsLoginClicked = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setSmsLoading(true);
    setShowSmsLoginModal(true);
    setSmsLoading(false);
  };

  const validateSmsPhone = () => {
    const normalizedPhone = (phone || '').trim();
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      showError(t('请输入有效的中国大陆手机号'));
      return '';
    }
    return normalizedPhone;
  };

  const sendSmsVerificationCode = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    const normalizedPhone = validateSmsPhone();
    if (!normalizedPhone) return;

    setSmsCodeLoading(true);
    try {
      const res = await API.post(
        `/api/sms/verification?turnstile=${turnstileToken}`,
        {
          phone: normalizedPhone,
        },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码已发送'));
        setSmsCountdown(60);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('验证码发送失败，请重试'));
    } finally {
      setSmsCodeLoading(false);
    }
  };

  const onSubmitSmsLogin = async () => {
    const normalizedPhone = validateSmsPhone();
    if (!normalizedPhone) return;
    if (!sms_verification_code) {
      showError(t('请输入验证码'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }

    setSmsLoginLoading(true);
    try {
      const res = await API.post(
        `/api/user/phone/login?turnstile=${turnstileToken}`,
        {
          phone: normalizedPhone,
          code: sms_verification_code,
        },
      );
      const { success, message, data } = res.data;
      if (success) {
        if (data && data.require_2fa) {
          setShowSmsLoginModal(false);
          setShowTwoFA(true);
          return;
        }

        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        updateAPI();
        showSuccess(t('登录成功！'));
        navigate('/console');
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('登录失败，请重试'));
    } finally {
      setSmsLoginLoading(false);
    }
  };

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(
          `/api/user/login?turnstile=${turnstileToken}`,
          {
            username,
            password,
          },
        );
        const { success, message, data } = res.data;
        if (success) {
          // 检查是否需要2FA验证
          if (data && data.require_2fa) {
            setShowTwoFA(true);
            setLoginLoading(false);
            return;
          }

          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess(t('登录成功！'));
          if (username === 'root' && password === '123456') {
            Modal.error({
              title: t('您正在使用默认密码！'),
              content: t('请立刻修改默认密码！'),
              centered: true,
            });
          }
          navigate('/console');
        } else {
          showError(message);
        }
      } else {
        showError(t('请输入用户名和密码！'));
      }
    } catch (error) {
      showError(t('登录失败，请重试'));
    } finally {
      setLoginLoading(false);
    }
  }

  // 添加Telegram登录处理函数
  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    const fields = [
      'id',
      'first_name',
      'last_name',
      'username',
      'photo_url',
      'auth_date',
      'hash',
      'lang',
    ];
    const params = {};
    fields.forEach((field) => {
      if (response[field]) {
        params[field] = response[field];
      }
    });
    try {
      const res = await API.get(`/api/oauth/telegram/login`, { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess(t('登录成功！'));
        setUserData(data);
        updateAPI();
        navigate('/');
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('登录失败，请重试'));
    }
  };

  // 包装的GitHub登录点击处理
  const handleGitHubClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (githubButtonDisabled) {
      return;
    }
    setGithubLoading(true);
    setGithubButtonDisabled(true);
    setGithubButtonState('redirecting');
    if (githubTimeoutRef.current) {
      clearTimeout(githubTimeoutRef.current);
    }
    githubTimeoutRef.current = setTimeout(() => {
      setGithubLoading(false);
      setGithubButtonState('timeout');
      setGithubButtonDisabled(true);
    }, 20000);
    try {
      onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setGithubLoading(false), 3000);
    }
  };

  // 包装的Discord登录点击处理
  const handleDiscordClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setDiscordLoading(true);
    try {
      onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setDiscordLoading(false), 3000);
    }
  };

  // 包装的OIDC登录点击处理
  const handleOIDCClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setOidcLoading(true);
    try {
      onOIDCClicked(
        status.oidc_authorization_endpoint,
        status.oidc_client_id,
        false,
        { shouldLogout: true },
      );
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setOidcLoading(false), 3000);
    }
  };

  // 包装的LinuxDO登录点击处理
  const handleLinuxDOClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setLinuxdoLoading(true);
    try {
      onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setLinuxdoLoading(false), 3000);
    }
  };

  // 包装的自定义OAuth登录点击处理
  const handleCustomOAuthClick = (provider) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try {
      onCustomOAuthClicked(provider, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => {
        setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false }));
      }, 3000);
    }
  };

  // 包装的邮箱登录选项点击处理
  const handleEmailLoginClick = () => {
    setEmailLoginLoading(true);
    setShowEmailLogin(true);
    setEmailLoginLoading(false);
  };

  const handlePasskeyLogin = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (!passkeySupported) {
      showInfo(t('当前环境无法使用 Passkey 登录'));
      return;
    }
    if (!window.PublicKeyCredential) {
      showInfo(t('当前浏览器不支持 Passkey'));
      return;
    }

    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data;
      if (!success) {
        showError(message || t('无法发起 Passkey 登录'));
        return;
      }

      const publicKeyOptions = prepareCredentialRequestOptions(
        data?.options || data?.publicKey || data,
      );
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });
      const payload = buildAssertionResult(assertion);
      if (!payload) {
        showError(t('Passkey 验证失败，请重试'));
        return;
      }

      const finishRes = await API.post(
        '/api/user/passkey/login/finish',
        payload,
      );
      const finish = finishRes.data;
      if (finish.success) {
        userDispatch({ type: 'login', payload: finish.data });
        setUserData(finish.data);
        updateAPI();
        showSuccess(t('登录成功！'));
        navigate('/console');
      } else {
        showError(finish.message || t('Passkey 登录失败，请重试'));
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        showInfo(t('已取消 Passkey 登录'));
      } else {
        showError(t('Passkey 登录失败，请重试'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // 包装的重置密码点击处理
  const handleResetPasswordClick = () => {
    setResetPasswordLoading(true);
    navigate('/reset');
    setResetPasswordLoading(false);
  };

  // 包装的其他登录选项点击处理
  const handleOtherLoginOptionsClick = () => {
    setOtherLoginOptionsLoading(true);
    setShowEmailLogin(false);
    setOtherLoginOptionsLoading(false);
  };

  // 2FA验证成功处理
  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess(t('登录成功！'));
    navigate('/console');
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({
      username: '',
      password: '',
      phone: '',
      sms_verification_code: '',
      wechat_verification_code: '',
    });
  };

  const renderOAuthOptions = () => (
    <Card className='auth-card-shell'>
      <div className='auth-card-body'>
        <div className='auth-card-header'>
          <div className='auth-card-heading-row'>
            <span className='auth-card-heading-mark'>✦</span>
            <Title heading={3} className='auth-card-title'>
              {t('登录')}
            </Title>
          </div>
        </div>

        <div className='auth-provider-stack'>
          {status.wechat_login && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />}
              onClick={onWeChatLoginClicked}
              loading={wechatLoading}
            >
              <span className='ml-3'>{t('使用 微信 继续')}</span>
            </Button>
          )}

          {status.sms_login && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={<IconMail size='large' />}
              onClick={onSmsLoginClicked}
              loading={smsLoading}
            >
              <span className='ml-3'>{t('使用 短信验证码 登录')}</span>
            </Button>
          )}

          {status.github_oauth && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={<IconGithubLogo size='large' />}
              onClick={handleGitHubClick}
              loading={githubLoading}
              disabled={githubButtonDisabled}
            >
              <span className='ml-3'>{githubButtonText}</span>
            </Button>
          )}

          {status.discord_oauth && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={
                <SiDiscord
                  style={{
                    color: '#5865F2',
                    width: '20px',
                    height: '20px',
                  }}
                />
              }
              onClick={handleDiscordClick}
              loading={discordLoading}
            >
              <span className='ml-3'>{t('使用 Discord 继续')}</span>
            </Button>
          )}

          {status.oidc_enabled && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={<OIDCIcon style={{ color: '#1877F2' }} />}
              onClick={handleOIDCClick}
              loading={oidcLoading}
            >
              <span className='ml-3'>{t('使用 OIDC 继续')}</span>
            </Button>
          )}

          {status.linuxdo_oauth && (
            <Button
              theme='outline'
              className='auth-provider-button'
              type='tertiary'
              icon={
                <LinuxDoIcon
                  style={{
                    color: '#E95420',
                    width: '20px',
                    height: '20px',
                  }}
                />
              }
              onClick={handleLinuxDOClick}
              loading={linuxdoLoading}
            >
              <span className='ml-3'>{t('使用 LinuxDO 继续')}</span>
            </Button>
          )}

          {status.custom_oauth_providers &&
            status.custom_oauth_providers.map((provider) => (
              <Button
                key={provider.slug}
                theme='outline'
                className='auth-provider-button'
                type='tertiary'
                icon={getOAuthProviderIcon(provider.icon || '', 20)}
                onClick={() => handleCustomOAuthClick(provider)}
                loading={customOAuthLoading[provider.slug]}
              >
                <span className='ml-3'>
                  {t('使用 {{name}} 继续', { name: provider.name })}
                </span>
              </Button>
            ))}

          {status.telegram_oauth && (
            <div className='flex justify-center my-1'>
              <TelegramLoginButton
                dataOnauth={onTelegramLoginClicked}
                botName={status.telegram_bot_name}
              />
            </div>
          )}

          {status.passkey_login && passkeySupported && (
            <Button
              theme='outline'
              className='auth-secondary-button'
              type='tertiary'
              icon={<IconKey size='large' />}
              onClick={handlePasskeyLogin}
              loading={passkeyLoading}
            >
              <span className='ml-3'>{t('使用 Passkey 登录')}</span>
            </Button>
          )}

          <Divider margin='12px' align='center'>
            {t('或')}
          </Divider>

          <Button
            theme='solid'
            type='primary'
            className='auth-primary-button'
            icon={<IconMail size='large' />}
            onClick={handleEmailLoginClick}
            loading={emailLoginLoading}
          >
            <span className='ml-3'>{t('使用 邮箱或用户名 登录')}</span>
          </Button>
        </div>

        {(hasUserAgreement || hasPrivacyPolicy) && (
          <div className='auth-terms'>
            <Checkbox
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            >
              <Text size='small'>
                {t('我已阅读并同意')}
                {hasUserAgreement && (
                  <a
                    href='/user-agreement'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='auth-policy-link'
                  >
                    {t('用户协议')}
                  </a>
                )}
                {hasUserAgreement && hasPrivacyPolicy && t('和')}
                {hasPrivacyPolicy && (
                  <a
                    href='/privacy-policy'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='auth-policy-link'
                  >
                    {t('隐私政策')}
                  </a>
                )}
              </Text>
            </Checkbox>
          </div>
        )}

        {!status.self_use_mode_enabled && (
          <div className='auth-switch-row text-sm'>
            <Text>
              {t('没有账户？')}{' '}
              <Link to='/register' className='auth-switch-link'>
                {t('注册')}
              </Link>
            </Text>
          </div>
        )}
      </div>
    </Card>
  );

  const renderEmailLoginForm = () => (
    <Card className='auth-card-shell'>
      <div className='auth-card-body'>
        <div className='auth-card-header'>
          <div className='auth-card-heading-row'>
            <span className='auth-card-heading-mark'>✦</span>
            <Title heading={3} className='auth-card-title'>
              {t('登录')}
            </Title>
          </div>
        </div>

        <div className='auth-form-stack'>
          {status.passkey_login && passkeySupported && (
            <Button
              theme='outline'
              type='tertiary'
              className='auth-secondary-button'
              icon={<IconKey size='large' />}
              onClick={handlePasskeyLogin}
              loading={passkeyLoading}
            >
              <span className='ml-3'>{t('使用 Passkey 登录')}</span>
            </Button>
          )}

          <Form className='auth-form-stack'>
            <Form.Input
              className='auth-input'
              field='username'
              label={t('用户名或邮箱')}
              placeholder={t('请输入您的用户名或邮箱地址')}
              name='username'
              onChange={(value) => handleChange('username', value)}
              prefix={<IconMail />}
            />

            <Form.Input
              className='auth-input'
              field='password'
              label={t('密码')}
              placeholder={t('请输入您的密码')}
              name='password'
              mode='password'
              onChange={(value) => handleChange('password', value)}
              prefix={<IconLock />}
            />

            {(hasUserAgreement || hasPrivacyPolicy) && (
              <div className='auth-terms'>
                <Checkbox
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                >
                  <Text size='small'>
                    {t('我已阅读并同意')}
                    {hasUserAgreement && (
                      <a
                        href='/user-agreement'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='auth-policy-link'
                      >
                        {t('用户协议')}
                      </a>
                    )}
                    {hasUserAgreement && hasPrivacyPolicy && t('和')}
                    {hasPrivacyPolicy && (
                      <a
                        href='/privacy-policy'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='auth-policy-link'
                      >
                        {t('隐私政策')}
                      </a>
                    )}
                  </Text>
                </Checkbox>
              </div>
            )}

            <div className='auth-form-actions'>
              <Button
                theme='solid'
                className='auth-primary-button'
                type='primary'
                htmlType='submit'
                onClick={handleSubmit}
                loading={loginLoading}
                disabled={
                  (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                }
              >
                {t('继续')}
              </Button>

              <Button
                theme='borderless'
                type='tertiary'
                className='auth-tertiary-button'
                onClick={handleResetPasswordClick}
                loading={resetPasswordLoading}
              >
                {t('忘记密码？')}
              </Button>

              {status.sms_login && (
                <Button
                  theme='borderless'
                  type='tertiary'
                  className='auth-tertiary-button'
                  onClick={onSmsLoginClicked}
                  loading={smsLoading}
                >
                  {t('短信验证码登录')}
                </Button>
              )}
            </div>
          </Form>

          {hasOAuthLoginOptions && (
            <>
              <Divider margin='12px' align='center'>
                {t('或')}
              </Divider>

              <div className='text-center'>
                <Button
                  theme='outline'
                  type='tertiary'
                  className='auth-secondary-button'
                  onClick={handleOtherLoginOptionsClick}
                  loading={otherLoginOptionsLoading}
                >
                  {t('其他登录选项')}
                </Button>
              </div>
            </>
          )}

          {!status.self_use_mode_enabled && (
            <div className='auth-switch-row text-sm'>
              <Text>
                {t('没有账户？')}{' '}
                <Link to='/register' className='auth-switch-link'>
                  {t('注册')}
                </Link>
              </Text>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // 微信登录模态框
  const renderWeChatLoginModal = () => {
    return (
      <Modal
        title={t('微信扫码登录')}
        visible={showWeChatLoginModal}
        maskClosable={true}
        onOk={onSubmitWeChatVerificationCode}
        onCancel={() => setShowWeChatLoginModal(false)}
        okText={t('登录')}
        centered={true}
        okButtonProps={{
          loading: wechatCodeSubmitLoading,
        }}
      >
        <div className='flex flex-col items-center'>
          <img
            src={status.wechat_qrcode}
            alt={t('微信二维码')}
            className='mb-4'
          />
        </div>

        <div className='text-center mb-4'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>

        <Form>
          <Form.Input
            field='wechat_verification_code'
            placeholder={t('验证码')}
            label={t('验证码')}
            value={inputs.wechat_verification_code}
            onChange={(value) =>
              handleChange('wechat_verification_code', value)
            }
          />
        </Form>
      </Modal>
    );
  };

  const renderSmsLoginModal = () => {
    return (
      <Modal
        title={t('短信验证码登录')}
        visible={showSmsLoginModal}
        maskClosable={true}
        onCancel={() => setShowSmsLoginModal(false)}
        footer={
          <div className='flex justify-end gap-2'>
            <Button onClick={() => setShowSmsLoginModal(false)}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              onClick={onSubmitSmsLogin}
              loading={smsLoginLoading}
            >
              {t('登录')}
            </Button>
          </div>
        }
        centered={true}
      >
        <Form>
          <Form.Input
            field='phone'
            placeholder={t('请输入中国大陆手机号')}
            label={t('手机号')}
            value={phone}
            onChange={(value) => handleChange('phone', value)}
            prefix={<IconMail />}
          />
          <Form.Input
            field='sms_verification_code'
            placeholder={t('验证码')}
            label={t('验证码')}
            value={sms_verification_code}
            onChange={(value) => handleChange('sms_verification_code', value)}
            suffix={
              <Button
                theme='borderless'
                type='primary'
                onClick={sendSmsVerificationCode}
                loading={smsCodeLoading}
                disabled={smsCountdown > 0}
              >
                {smsCountdown > 0
                  ? t('{{count}} 秒后重试', { count: smsCountdown })
                  : t('发送验证码')}
              </Button>
            }
          />
        </Form>
      </Modal>
    );
  };

  // 2FA验证弹窗
  const render2FAModal = () => {
    return (
      <Modal
        title={
          <div className='flex items-center'>
            <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3'>
              <svg
                className='w-4 h-4 text-green-600 dark:text-green-400'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M6 8a2 2 0 11-4 0 2 2 0 014 0zM8 7a1 1 0 100 2h8a1 1 0 100-2H8zM6 14a2 2 0 11-4 0 2 2 0 014 0zM8 13a1 1 0 100 2h8a1 1 0 100-2H8z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            {t('两步验证')}
          </div>
        }
        visible={showTwoFA}
        onCancel={handleBackToLogin}
        footer={null}
        width={450}
        centered
      >
        <TwoFAVerification
          onSuccess={handle2FASuccess}
          onBack={handleBackToLogin}
          isModal={true}
        />
      </Modal>
    );
  };

  return (
    <AuthLayout
      variant='login'
      badge={t('安全登录')}
      title={t('登录')}
      description={t('进入控制台，管理令牌、账单、日志和模型。')}
      sideTitle={t('欢迎回来')}
      sideDescription={t('一站式访问你的 AI 网关控制台，兼顾效率与安全。')}
      highlights={authHighlights}
      turnstile={
        turnstileEnabled ? (
          <Turnstile
            sitekey={turnstileSiteKey}
            onVerify={(token) => {
              setTurnstileToken(token);
            }}
          />
        ) : null
      }
    >
      {showEmailLogin || !hasOAuthLoginOptions
        ? renderEmailLoginForm()
        : renderOAuthOptions()}
      {renderWeChatLoginModal()}
      {renderSmsLoginModal()}
      {render2FAModal()}
    </AuthLayout>
  );
};

export default LoginForm;
