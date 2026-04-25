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
import { useNavigate } from 'react-router-dom';
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
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button } from '@heroui/react';
import {
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
} from '../../helpers';
import OIDCIcon from '../common/logo/OIDCIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import TelegramLoginButton from 'react-telegram-login/src';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';
import { SiDiscord, SiGithub } from 'react-icons/si';
import { KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react';
import {
  AuthAgreement,
  AuthBrand,
  AuthDivider,
  AuthLinkRow,
  AuthModal,
  AuthOutlineButton,
  AuthPage,
  AuthPanel,
  AuthPrimaryButton,
  AuthTextField,
} from './AuthLayout';

const RegisterForm = () => {
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
    password2: '',
    email: '',
    verification_code: '',
    wechat_verification_code: '',
  });
  const { username, password, password2 } = inputs;
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailRegister, setShowEmailRegister] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailRegisterLoading, setEmailRegisterLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [otherRegisterOptionsLoading, setOtherRegisterOptionsLoading] =
    useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);

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
  const hasOAuthRegisterOptions = Boolean(
    status.github_oauth ||
      status.discord_oauth ||
      status.oidc_enabled ||
      status.wechat_login ||
      status.linuxdo_oauth ||
      status.telegram_oauth ||
      hasCustomOAuthProviders,
  );

  const [showEmailVerification, setShowEmailVerification] = useState(false);

  useEffect(() => {
    setShowEmailVerification(!!status?.email_verification);
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }

    // 从 status 获取用户协议和隐私政策的启用状态
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval); // Clean up on unmount
  }, [disableButton, countdown]);

  useEffect(() => {
    return () => {
      if (githubTimeoutRef.current) {
        clearTimeout(githubTimeoutRef.current);
      }
    };
  }, []);

  const onWeChatLoginClicked = () => {
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
    if (password.length < 8) {
      showInfo('密码长度不得小于 8 位！');
      return;
    }
    if (password !== password2) {
      showInfo('两次输入的密码不一致');
      return;
    }
    if (username && password) {
      if (turnstileEnabled && turnstileToken === '') {
        showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
        return;
      }
      setRegisterLoading(true);
      try {
        if (!affCode) {
          affCode = localStorage.getItem('aff');
        }
        inputs.aff_code = affCode;
        const res = await API.post(
          `/api/user/register?turnstile=${turnstileToken}`,
          inputs,
        );
        const { success, message } = res.data;
        if (success) {
          navigate('/login');
          showSuccess('注册成功！');
        } else {
          showError(message);
        }
      } catch (error) {
        showError('注册失败，请重试');
      } finally {
        setRegisterLoading(false);
      }
    }
  }

  const sendVerificationCode = async () => {
    if (inputs.email === '') return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setVerificationCodeLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(inputs.email)}&turnstile=${turnstileToken}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess('验证码发送成功，请检查你的邮箱！');
        setDisableButton(true); // 发送成功后禁用按钮，开始倒计时
      } else {
        showError(message);
      }
    } catch (error) {
      showError('发送验证码失败，请重试');
    } finally {
      setVerificationCodeLoading(false);
    }
  };

  const handleGitHubClick = () => {
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
      setTimeout(() => setGithubLoading(false), 3000);
    }
  };

  const handleDiscordClick = () => {
    setDiscordLoading(true);
    try {
      onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true });
    } finally {
      setTimeout(() => setDiscordLoading(false), 3000);
    }
  };

  const handleOIDCClick = () => {
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
    setLinuxdoLoading(true);
    try {
      onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true });
    } finally {
      setTimeout(() => setLinuxdoLoading(false), 3000);
    }
  };

  const handleCustomOAuthClick = (provider) => {
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try {
      onCustomOAuthClicked(provider, { shouldLogout: true });
    } finally {
      setTimeout(() => {
        setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false }));
      }, 3000);
    }
  };

  const handleEmailRegisterClick = () => {
    setEmailRegisterLoading(true);
    setShowEmailRegister(true);
    setEmailRegisterLoading(false);
  };

  const handleOtherRegisterOptionsClick = () => {
    setOtherRegisterOptionsLoading(true);
    setShowEmailRegister(false);
    setOtherRegisterOptionsLoading(false);
  };

  const onTelegramLoginClicked = async (response) => {
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

  const renderOAuthOptions = () => {
    return (
      <>
        <AuthBrand logo={logo} systemName={systemName} />
        <AuthPanel
          title={t('注 册')}
          subtitle={t('先选择一种便捷方式，或继续使用用户名注册。')}
        >
          <div className='space-y-3'>
                {status.wechat_login && (
                  <AuthOutlineButton
                    startContent={
                      <WeChatIcon style={{ color: '#07C160' }} />
                    }
                    onPress={onWeChatLoginClicked}
                    isPending={wechatLoading}
                  >
                    {t('使用 微信 继续')}
                  </AuthOutlineButton>
                )}

                {status.github_oauth && (
                  <AuthOutlineButton
                    startContent={<SiGithub size={20} />}
                    onPress={handleGitHubClick}
                    isPending={githubLoading}
                    isDisabled={githubButtonDisabled}
                  >
                    {githubButtonText}
                  </AuthOutlineButton>
                )}

                {status.discord_oauth && (
                  <AuthOutlineButton
                    startContent={
                      <SiDiscord
                        style={{
                          color: '#5865F2',
                          width: '20px',
                          height: '20px',
                        }}
                      />
                    }
                    onPress={handleDiscordClick}
                    isPending={discordLoading}
                  >
                    {t('使用 Discord 继续')}
                  </AuthOutlineButton>
                )}

                {status.oidc_enabled && (
                  <AuthOutlineButton
                    startContent={<OIDCIcon style={{ color: '#1877F2' }} />}
                    onPress={handleOIDCClick}
                    isPending={oidcLoading}
                  >
                    {t('使用 OIDC 继续')}
                  </AuthOutlineButton>
                )}

                {status.linuxdo_oauth && (
                  <AuthOutlineButton
                    startContent={
                      <LinuxDoIcon
                        style={{
                          color: '#E95420',
                          width: '20px',
                          height: '20px',
                        }}
                      />
                    }
                    onPress={handleLinuxDOClick}
                    isPending={linuxdoLoading}
                  >
                    {t('使用 LinuxDO 继续')}
                  </AuthOutlineButton>
                )}

                {status.custom_oauth_providers &&
                  status.custom_oauth_providers.map((provider) => (
                    <AuthOutlineButton
                      key={provider.slug}
                      startContent={getOAuthProviderIcon(provider.icon || '', 20)}
                      onPress={() => handleCustomOAuthClick(provider)}
                      isPending={customOAuthLoading[provider.slug]}
                    >
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

                <AuthDivider>{t('或')}</AuthDivider>

                <AuthPrimaryButton
                  startContent={<Mail size={20} />}
                  onPress={handleEmailRegisterClick}
                  isPending={emailRegisterLoading}
                  className='bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950'
                >
                  {t('使用 用户名 注册')}
                </AuthPrimaryButton>
              </div>

          <AuthLinkRow prefix={t('已有账户？')} linkText={t('登录')} to='/login' />
        </AuthPanel>
      </>
    );
  };

  const renderEmailRegisterForm = () => {
    return (
      <>
        <AuthBrand logo={logo} systemName={systemName} />
        <AuthPanel
          title={t('注 册')}
          subtitle={t('创建一个新账户，稍后可以继续使用第三方登录。')}
        >
              <form
                className='space-y-3'
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmit();
                }}
              >
                <AuthTextField
                  label={t('用户名')}
                  placeholder={t('请输入用户名')}
                  name='username'
                  value={inputs.username}
                  onChange={(event) =>
                    handleChange('username', event.target.value)
                  }
                  icon={<UserRound size={18} />}
                />

                <AuthTextField
                  label={t('密码')}
                  placeholder={t('输入密码，最短 8 位，最长 20 位')}
                  name='password'
                  type='password'
                  value={inputs.password}
                  onChange={(event) =>
                    handleChange('password', event.target.value)
                  }
                  icon={<LockKeyhole size={18} />}
                />

                <AuthTextField
                  label={t('确认密码')}
                  placeholder={t('确认密码')}
                  name='password2'
                  type='password'
                  value={inputs.password2}
                  onChange={(event) =>
                    handleChange('password2', event.target.value)
                  }
                  icon={<LockKeyhole size={18} />}
                />

                {showEmailVerification && (
                  <>
                    <AuthTextField
                      label={t('邮箱')}
                      placeholder={t('输入邮箱地址')}
                      name='email'
                      type='email'
                      value={inputs.email}
                      onChange={(event) =>
                        handleChange('email', event.target.value)
                      }
                      icon={<Mail size={18} />}
                      action={
                        <Button
                          size='sm'
                          variant='secondary'
                          onPress={sendVerificationCode}
                          isPending={verificationCodeLoading}
                          isDisabled={disableButton || verificationCodeLoading}
                          className='rounded-xl'
                        >
                          {disableButton
                            ? `${t('重新发送')} (${countdown})`
                            : t('获取验证码')}
                        </Button>
                      }
                    />
                    <AuthTextField
                      label={t('验证码')}
                      placeholder={t('输入验证码')}
                      name='verification_code'
                      value={inputs.verification_code}
                      onChange={(event) =>
                        handleChange('verification_code', event.target.value)
                      }
                      icon={<KeyRound size={18} />}
                    />
                  </>
                )}

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
                    isPending={registerLoading}
                    isDisabled={
                      (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                    }
                  >
                    {t('注册')}
                  </AuthPrimaryButton>
                </div>
              </form>

              {hasOAuthRegisterOptions && (
                <>
                  <AuthDivider>{t('或')}</AuthDivider>

                  <div className='mt-4 text-center'>
                    <AuthOutlineButton
                      onPress={handleOtherRegisterOptionsClick}
                      isPending={otherRegisterOptionsLoading}
                    >
                      {t('其他注册选项')}
                    </AuthOutlineButton>
                  </div>
                </>
              )}

          <AuthLinkRow prefix={t('已有账户？')} linkText={t('登录')} to='/login' />
        </AuthPanel>
      </>
    );
  };

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
      {showEmailRegister || !hasOAuthRegisterOptions
        ? renderEmailRegisterForm()
        : renderOAuthOptions()}
      {renderWeChatLoginModal()}
    </AuthPage>
  );
};

export default RegisterForm;
