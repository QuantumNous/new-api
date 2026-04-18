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
  getSystemName,
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
import { Button, Checkbox, Divider, Icon, Modal } from '@douyinfe/semi-ui';
import TelegramLoginButton from 'react-telegram-login';
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
import AuthShell from './AuthShell';
import { getAuthPageCopy } from './authShellContent';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const inputClassName =
  'auth-theme-input w-full h-12 rounded-xl border px-4 text-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10';
const primaryButtonClassName =
  'auth-theme-primary-button !h-12 !w-full !rounded-xl !border-0';
const providerButtonClassName =
  'auth-theme-provider-button !h-12 !w-full !justify-center !rounded-xl !border';

const LoginForm = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    wechat_verification_code: '',
  });
  const { username, password } = inputs;
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const systemName = getSystemName();

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
  const pageCopy = useMemo(
    () => getAuthPageCopy('login', t, systemName),
    [systemName, t],
  );
  const hasCustomOAuthProviders =
    (status.custom_oauth_providers || []).length > 0;
  const hasOAuthLoginOptions = Boolean(
    status.github_oauth ||
      status.discord_oauth ||
      status.oidc_enabled ||
      status.wechat_login ||
      status.linuxdo_oauth ||
      status.telegram_oauth ||
      hasCustomOAuthProviders,
  );
  const hasOtherLoginOptions =
    hasOAuthLoginOptions || (status.passkey_login && passkeySupported);

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }

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
  }, [searchParams, t]);

  const ensureTermsAccepted = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return false;
    }
    return true;
  };

  const ensureTurnstileReady = () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return false;
    }
    return true;
  };

  const handleChange = (name, value) => {
    setInputs((current) => ({ ...current, [name]: value }));
  };

  const onWeChatLoginClicked = () => {
    if (!ensureTermsAccepted()) {
      return;
    }
    setWechatLoading(true);
    setShowWeChatLoginModal(true);
    setWechatLoading(false);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (!ensureTurnstileReady()) {
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
        setUserData(data);
        updateAPI();
        navigate('/');
        showSuccess('登录成功！');
        setShowWeChatLoginModal(false);
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setWechatCodeSubmitLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!ensureTermsAccepted() || !ensureTurnstileReady()) {
      return;
    }
    setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(`/api/user/login?turnstile=${turnstileToken}`,
          {
            username,
            password,
          },
        );
        const { success, message, data } = res.data;
        if (success) {
          if (data && data.require_2fa) {
            setShowTwoFA(true);
            setLoginLoading(false);
            return;
          }

          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') {
            Modal.error({
              title: '您正在使用默认密码！',
              content: '请立刻修改默认密码！',
              centered: true,
            });
          }
          navigate('/console');
        } else {
          showError(message);
        }
      } else {
        showError('请输入用户名和密码！');
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  const onTelegramLoginClicked = async (response) => {
    if (!ensureTermsAccepted()) {
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
      const res = await API.get('/api/oauth/telegram/login', { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        showSuccess('登录成功！');
        updateAPI();
        navigate('/');
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    }
  };

  const handleGitHubClick = () => {
    if (!ensureTermsAccepted() || githubButtonDisabled) {
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
      setTimeout(() => setGithubLoading(false), 3000);
    }
  };

  const handleDiscordClick = () => {
    if (!ensureTermsAccepted()) {
      return;
    }
    setDiscordLoading(true);
    try {
      onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true });
    } finally {
      setTimeout(() => setDiscordLoading(false), 3000);
    }
  };

  const handleOIDCClick = () => {
    if (!ensureTermsAccepted()) {
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
      setTimeout(() => setOidcLoading(false), 3000);
    }
  };

  const handleLinuxDOClick = () => {
    if (!ensureTermsAccepted()) {
      return;
    }
    setLinuxdoLoading(true);
    try {
      onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true });
    } finally {
      setTimeout(() => setLinuxdoLoading(false), 3000);
    }
  };

  const handleCustomOAuthClick = (provider) => {
    if (!ensureTermsAccepted()) {
      return;
    }
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try {
      onCustomOAuthClicked(provider, { shouldLogout: true });
    } finally {
      setTimeout(() => {
        setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false }));
      }, 3000);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!ensureTermsAccepted()) {
      return;
    }
    if (!passkeySupported) {
      showInfo('当前环境无法使用 Passkey 登录');
      return;
    }
    if (!window.PublicKeyCredential) {
      showInfo('当前浏览器不支持 Passkey');
      return;
    }

    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data;
      if (!success) {
        showError(message || '无法发起 Passkey 登录');
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
        showError('Passkey 验证失败，请重试');
        return;
      }

      const finishRes = await API.post('/api/user/passkey/login/finish', payload);
      const finish = finishRes.data;
      if (finish.success) {
        userDispatch({ type: 'login', payload: finish.data });
        setUserData(finish.data);
        updateAPI();
        showSuccess('登录成功！');
        navigate('/console');
      } else {
        showError(finish.message || 'Passkey 登录失败，请重试');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        showInfo('已取消 Passkey 登录');
      } else {
        showError('Passkey 登录失败，请重试');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    navigate('/console');
  };

  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '', wechat_verification_code: '' });
  };

  const renderTerms = () => {
    if (!hasUserAgreement && !hasPrivacyPolicy) {
      return null;
    }

    return (
      <div className='auth-theme-terms-box rounded-2xl px-4 py-3'>
        <Checkbox
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
        >
          <span className='auth-theme-terms-text text-sm leading-6'>
            {t('我已阅读并同意')}
            {hasUserAgreement && (
              <a
                href='/user-agreement'
                target='_blank'
                rel='noopener noreferrer'
                className='auth-theme-link mx-1'
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
                className='auth-theme-link mx-1'
              >
                {t('隐私政策')}
              </a>
            )}
          </span>
        </Checkbox>
      </div>
    );
  };

  const renderOtherLoginOptions = () => {
    if (!hasOtherLoginOptions) {
      return null;
    }

    return (
      <>
        <Divider margin='28px' align='center'>
          <span className='auth-theme-divider-text px-2 text-xs font-medium'>
            {t('其他登录选项')}
          </span>
        </Divider>

        <div className='space-y-3'>
          {status.passkey_login && passkeySupported && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={<IconKey size='large' />}
              onClick={handlePasskeyLogin}
              loading={passkeyLoading}
            >
              {t('使用 Passkey 登录')}
            </Button>
          )}

          {status.github_oauth && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={<IconGithubLogo size='large' />}
              onClick={handleGitHubClick}
              loading={githubLoading}
              disabled={githubButtonDisabled}
            >
              {githubButtonText}
            </Button>
          )}

          {status.discord_oauth && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={
                <SiDiscord
                  style={{
                    color: '#5865F2',
                    width: '18px',
                    height: '18px',
                  }}
                />
              }
              onClick={handleDiscordClick}
              loading={discordLoading}
            >
              {t('使用 Discord 继续')}
            </Button>
          )}

          {status.oidc_enabled && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={<OIDCIcon style={{ color: '#1877F2' }} />}
              onClick={handleOIDCClick}
              loading={oidcLoading}
            >
              {t('使用 OIDC 继续')}
            </Button>
          )}

          {status.linuxdo_oauth && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={
                <LinuxDoIcon
                  style={{ color: '#E95420', width: '18px', height: '18px' }}
                />
              }
              onClick={handleLinuxDOClick}
              loading={linuxdoLoading}
            >
              {t('使用 LinuxDO 继续')}
            </Button>
          )}

          {status.wechat_login && (
            <Button
              theme='outline'
              type='tertiary'
              className={providerButtonClassName}
              icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />}
              onClick={onWeChatLoginClicked}
              loading={wechatLoading}
            >
              {t('使用 微信 继续')}
            </Button>
          )}

          {status.custom_oauth_providers &&
            status.custom_oauth_providers.map((provider) => (
              <Button
                key={provider.slug}
                theme='outline'
                type='tertiary'
                className={providerButtonClassName}
                icon={getOAuthProviderIcon(provider.icon || '', 18)}
                onClick={() => handleCustomOAuthClick(provider)}
                loading={customOAuthLoading[provider.slug]}
              >
                {t('使用 {{name}} 继续', { name: provider.name })}
              </Button>
            ))}

          {status.telegram_oauth && (
            <div className='auth-theme-telegram-wrapper overflow-hidden rounded-xl border p-2'>
              <div className='flex justify-center'>
                <TelegramLoginButton
                  dataOnauth={onTelegramLoginClicked}
                  botName={status.telegram_bot_name}
                />
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

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
          <img src={status.wechat_qrcode} alt='微信二维码' className='mb-4' />
        </div>

        <div className='mb-4 text-center'>
          <p>{t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}</p>
        </div>

        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('验证码')}
          </label>
          <input
            type='text'
            className={inputClassName}
            value={inputs.wechat_verification_code}
            onChange={(event) =>
              handleChange('wechat_verification_code', event.target.value)
            }
          />
        </div>
      </Modal>
    );
  };

  const render2FAModal = () => {
    return (
      <Modal
        title={
          <div className='flex items-center'>
            <div className='auth-theme-twofa-icon mr-3 flex h-8 w-8 items-center justify-center rounded-full'>
              <svg
                className='auth-theme-twofa-icon-svg h-4 w-4'
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
            两步验证
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
    <AuthShell mode='login'>
      <form className='space-y-5' onSubmit={handleSubmit}>
        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('用户名或邮箱')}
          </label>
          <input
            type='text'
            name='username'
            autoComplete='username'
            placeholder={t('请输入您的用户名或邮箱地址')}
            className={inputClassName}
            value={username}
            onChange={(event) => handleChange('username', event.target.value)}
          />
        </div>

        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('密码')}
          </label>
          <input
            type='password'
            name='password'
            autoComplete='current-password'
            placeholder={t('请输入您的密码')}
            className={inputClassName}
            value={password}
            onChange={(event) => handleChange('password', event.target.value)}
          />
        </div>

        {renderTerms()}

        <Button
          theme='solid'
          type='primary'
          htmlType='submit'
          className={primaryButtonClassName}
          loading={loginLoading}
          disabled={(hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms}
          icon={<IconMail size='large' />}
        >
          {pageCopy.submitText}
        </Button>
      </form>

      {renderOtherLoginOptions()}

      {turnstileEnabled && (
        <div className='mt-6 flex justify-center'>
          <Turnstile
            sitekey={turnstileSiteKey}
            onVerify={(token) => {
              setTurnstileToken(token);
            }}
          />
        </div>
      )}

      <p className='auth-theme-switch-text mt-8 text-center text-sm'>
        {pageCopy.switchPrefix}{' '}
        <Link
          to={pageCopy.switchHref}
          className='auth-theme-switch-link font-medium'
        >
          {pageCopy.switchText}
        </Link>
      </p>

      {renderWeChatLoginModal()}
      {render2FAModal()}
    </AuthShell>
  );
};

export default LoginForm;
