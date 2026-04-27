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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getSystemName,
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
import TelegramLoginButton from 'react-telegram-login';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';
import { SiDiscord, SiGithub } from 'react-icons/si';
import { KeyRound, LockKeyhole, Mail } from 'lucide-react';
import {
  AuthAgreement,
  AuthBrand,
  AuthDivider,
  AuthGhostButton,
  AuthLinkRow,
  AuthModal,
  AuthOutlineButton,
  AuthPage,
  AuthPanel,
  AuthPrimaryButton,
  AuthTextField,
} from './AuthLayout';

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
    wechat_verification_code: '',
  });
  const { username, password } = inputs;
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
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

  const logo = getLogo();
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
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
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

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setSubmitted(true);
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
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') {
            showError('您正在使用默认密码！请立刻修改默认密码！');
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
        showSuccess('登录成功！');
        setUserData(data);
        updateAPI();
        navigate('/');
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
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

      const finishRes = await API.post(
        '/api/user/passkey/login/finish',
        payload,
      );
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
    showSuccess('登录成功！');
    navigate('/console');
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '', wechat_verification_code: '' });
  };

  const renderOAuthOptions = () => {
    return (
      <>
        <AuthBrand logo={logo} systemName={systemName} />
        <AuthPanel
          title={t('登 录')}
          subtitle={t('选择一种方式继续进入控制台。')}
        >
          <div className='space-y-3'>
            {status.wechat_login && (
              <AuthOutlineButton
                onPress={onWeChatLoginClicked}
                isPending={wechatLoading}
              >
                <WeChatIcon style={{ color: '#07C160' }} />
                {t('使用 微信 继续')}
              </AuthOutlineButton>
            )}

            {status.github_oauth && (
              <AuthOutlineButton
                onPress={handleGitHubClick}
                isPending={githubLoading}
                isDisabled={githubButtonDisabled}
              >
                <SiGithub size={20} />
                {githubButtonText}
              </AuthOutlineButton>
            )}

            {status.discord_oauth && (
              <AuthOutlineButton
                onPress={handleDiscordClick}
                isPending={discordLoading}
              >
                <SiDiscord
                  style={{
                    color: '#5865F2',
                    width: '20px',
                    height: '20px',
                  }}
                />
                {t('使用 Discord 继续')}
              </AuthOutlineButton>
            )}

            {status.oidc_enabled && (
              <AuthOutlineButton
                onPress={handleOIDCClick}
                isPending={oidcLoading}
              >
                <OIDCIcon style={{ color: '#1877F2' }} />
                {t('使用 OIDC 继续')}
              </AuthOutlineButton>
            )}

            {status.linuxdo_oauth && (
              <AuthOutlineButton
                onPress={handleLinuxDOClick}
                isPending={linuxdoLoading}
              >
                <LinuxDoIcon
                  style={{
                    color: '#E95420',
                    width: '20px',
                    height: '20px',
                  }}
                />
                {t('使用 LinuxDO 继续')}
              </AuthOutlineButton>
            )}

            {status.custom_oauth_providers &&
              status.custom_oauth_providers.map((provider) => (
                <AuthOutlineButton
                  key={provider.slug}
                  onPress={() => handleCustomOAuthClick(provider)}
                  isPending={customOAuthLoading[provider.slug]}
                >
                  {getOAuthProviderIcon(provider.icon || '', 20)}
                  {t('使用 {{name}} 继续', { name: provider.name })}
                </AuthOutlineButton>
              ))}

            {status.telegram_oauth && (
              <div className='flex justify-center my-2'>
                <TelegramLoginButton
                  dataOnauth={onTelegramLoginClicked}
                  botName={status.telegram_bot_name}
                />
              </div>
            )}

            {status.passkey_login && passkeySupported && (
              <AuthOutlineButton
                onPress={handlePasskeyLogin}
                isPending={passkeyLoading}
              >
                <KeyRound size={20} />
                {t('使用 Passkey 登录')}
              </AuthOutlineButton>
            )}

            <AuthDivider>{t('或')}</AuthDivider>

            <AuthPrimaryButton
              onPress={handleEmailLoginClick}
              isPending={emailLoginLoading}
              className='bg-foreground text-background'
            >
              <Mail size={20} />
              {t('使用 邮箱或用户名 登录')}
            </AuthPrimaryButton>
          </div>

          <AuthAgreement
            checked={agreedToTerms}
            onChange={setAgreedToTerms}
            hasUserAgreement={hasUserAgreement}
            hasPrivacyPolicy={hasPrivacyPolicy}
            t={t}
          />

          {!status.self_use_mode_enabled && (
            <AuthLinkRow
              prefix={t('没有账户？')}
              linkText={t('注册')}
              to='/register'
            />
          )}
        </AuthPanel>
      </>
    );
  };

  const renderEmailLoginForm = () => {
    return (
      <>
        <AuthBrand logo={logo} systemName={systemName} />
        <AuthPanel
          title={t('登 录')}
          subtitle={t('使用你的账户信息继续，或切换到更快捷的登录方式。')}
        >
          {status.passkey_login && passkeySupported && (
            <AuthOutlineButton
              onPress={handlePasskeyLogin}
              isPending={passkeyLoading}
              className='mb-4'
            >
              <KeyRound size={20} />
              {t('使用 Passkey 登录')}
            </AuthOutlineButton>
          )}
          <form
            className='space-y-3'
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <AuthTextField
              label={t('用户名或邮箱')}
              placeholder={t('请输入您的用户名或邮箱地址')}
              name='username'
              value={username}
              onChange={(event) => handleChange('username', event.target.value)}
              icon={<Mail size={18} />}
            />

            <AuthTextField
              label={t('密码')}
              placeholder={t('请输入您的密码')}
              name='password'
              type='password'
              value={password}
              onChange={(event) => handleChange('password', event.target.value)}
              icon={<LockKeyhole size={18} />}
            />

            <AuthAgreement
              checked={agreedToTerms}
              onChange={setAgreedToTerms}
              hasUserAgreement={hasUserAgreement}
              hasPrivacyPolicy={hasPrivacyPolicy}
              t={t}
            />

            <div className='space-y-2 pt-2'>
              <AuthPrimaryButton
                onPress={handleSubmit}
                isPending={loginLoading}
                isDisabled={
                  (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                }
              >
                {t('继续')}
              </AuthPrimaryButton>

              <AuthGhostButton
                onPress={handleResetPasswordClick}
                isPending={resetPasswordLoading}
              >
                {t('忘记密码？')}
              </AuthGhostButton>
            </div>
          </form>

          {hasOAuthLoginOptions && (
            <>
              <AuthDivider>{t('或')}</AuthDivider>

              <div className='mt-4 text-center'>
                <AuthOutlineButton
                  onPress={handleOtherLoginOptionsClick}
                  isPending={otherLoginOptionsLoading}
                >
                  {t('其他登录选项')}
                </AuthOutlineButton>
              </div>
            </>
          )}

          {!status.self_use_mode_enabled && (
            <AuthLinkRow
              prefix={t('没有账户？')}
              linkText={t('注册')}
              to='/register'
            />
          )}
        </AuthPanel>
      </>
    );
  };

  // 微信登录模态框
  const renderWeChatLoginModal = () => {
    return (
      <AuthModal
        title={t('微信扫码登录')}
        isOpen={showWeChatLoginModal}
        onClose={() => setShowWeChatLoginModal(false)}
        onConfirm={onSubmitWeChatVerificationCode}
        confirmText={t('登录')}
        cancelText={t('取消')}
        isConfirmLoading={wechatCodeSubmitLoading}
      >
        <div className='flex flex-col items-center'>
          <img src={status.wechat_qrcode} alt='微信二维码' className='mb-4' />
        </div>

        <div className='text-center mb-4'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitWeChatVerificationCode();
          }}
        >
          <AuthTextField
            placeholder={t('验证码')}
            label={t('验证码')}
            value={inputs.wechat_verification_code}
            onChange={(event) =>
              handleChange('wechat_verification_code', event.target.value)
            }
            icon={<KeyRound size={18} />}
          />
        </form>
      </AuthModal>
    );
  };

  // 2FA验证弹窗
  const render2FAModal = () => {
    return (
      <AuthModal
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
            两步验证
          </div>
        }
        isOpen={showTwoFA}
        onClose={handleBackToLogin}
        footer={null}
        size='md'
      >
        <TwoFAVerification
          onSuccess={handle2FASuccess}
          onBack={handleBackToLogin}
          isModal={true}
        />
      </AuthModal>
    );
  };

  return (
    <AuthPage
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
      {render2FAModal()}
    </AuthPage>
  );
};

export default LoginForm;
