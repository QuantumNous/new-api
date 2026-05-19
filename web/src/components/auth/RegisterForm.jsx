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
import { Link, useNavigate } from 'react-router-dom';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getOAuthProviderIcon,
  getSystemName,
  setUserData,
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Checkbox, Divider, Icon, Modal } from '@douyinfe/semi-ui';
import {
  IconGithubLogo,
  IconUser,
} from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import TelegramLoginButton from 'react-telegram-login/src';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import AuthShell from './AuthShell';
import { getAuthPageCopy } from './authShellContent';
import SliderCaptcha from './SliderCaptcha';
import {
  persistAllowedReturnTo,
  redirectAfterAuth,
  withAllowedReturnTo,
} from './returnTo';
import {
  clearPromotionReferral,
  getPromotionLinkReferral,
  persistPromotionLinkReferral,
  setPromotionManualReferral,
} from './promotionReferral';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const inputClassName =
  'auth-theme-input w-full h-12 rounded-xl border px-4 text-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10';
const primaryButtonClassName =
  'auth-theme-primary-button !h-12 !w-full !rounded-xl !border-0';
const providerButtonClassName =
  'auth-theme-provider-button !h-12 !w-full !justify-center !rounded-xl !border';
const secondaryButtonClassName =
  'auth-theme-secondary-button !h-12 !shrink-0 !rounded-xl !px-4';

const RegisterForm = () => {
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
    password2: '',
    email: '',
    verification_code: '',
    wechat_verification_code: '',
    manual_referral: '',
    link_referral: '',
  });
  const { username, password, password2 } = inputs;
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
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [sliderCaptchaResetSignal, setSliderCaptchaResetSignal] = useState(0);
  const [sliderCaptchaModalVisible, setSliderCaptchaModalVisible] =
    useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const systemName = getSystemName();

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
    () => getAuthPageCopy('register', t, systemName),
    [systemName, t],
  );
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

  useEffect(() => {
    persistAllowedReturnTo();
    persistPromotionLinkReferral();
    setInputs((current) => ({
      ...current,
      link_referral: getPromotionLinkReferral(),
    }));
  }, []);

  useEffect(() => {
    setShowEmailVerification(!!status?.email_verification);
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown((current) => current - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  useEffect(() => {
    return () => {
      if (githubTimeoutRef.current) {
        clearTimeout(githubTimeoutRef.current);
      }
    };
  }, []);

  const ensureTurnstileReady = () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return false;
    }
    return true;
  };

  const ensureTermsAccepted = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return false;
    }
    return true;
  };

  const resetSliderCaptcha = () => {
    setSliderCaptchaResetSignal((current) => current + 1);
  };

  const handleChange = (name, value) => {
    setInputs((current) => ({ ...current, [name]: value }));
    if (name === 'manual_referral') {
      setPromotionManualReferral(value);
    }
  };

  const onWeChatLoginClicked = () => {
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
        redirectAfterAuth(navigate, '/');
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

  const submitRegister = async () => {
    setRegisterLoading(true);
    try {
      const res = await API.post(
        `/api/user/register?turnstile=${turnstileToken}`,
        inputs,
      );
      const { success, message } = res.data;
      if (success) {
        clearPromotionReferral();
        navigate(withAllowedReturnTo('/login'));
        showSuccess('注册成功！');
      } else {
        showError(message);
        resetSliderCaptcha();
      }
    } catch (error) {
      showError('注册失败，请重试');
      resetSliderCaptcha();
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      showInfo('密码长度不得小于 8 位！');
      return;
    }
    if (password !== password2) {
      showInfo('两次输入的密码不一致');
      return;
    }
    if (!username || !password) {
      return;
    }
    if (!ensureTermsAccepted() || !ensureTurnstileReady()) {
      return;
    }
    resetSliderCaptcha();
    setSliderCaptchaModalVisible(true);
  };

  const handleSliderCaptchaVerified = () => {
    setSliderCaptchaModalVisible(false);
    submitRegister();
  };

  const sendVerificationCode = async () => {
    if (inputs.email === '') return;
    if (!ensureTurnstileReady()) {
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
        setDisableButton(true);
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
      const res = await API.get('/api/oauth/telegram/login', { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        showSuccess('登录成功！');
        updateAPI();
        redirectAfterAuth(navigate, '/');
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    }
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

  const renderOtherRegisterOptions = () => {
    if (!hasOAuthRegisterOptions) {
      return null;
    }

    return (
      <>
        <Divider margin='28px' align='center'>
          <span className='auth-theme-divider-text px-2 text-xs font-medium'>
            {t('其他注册选项')}
          </span>
        </Divider>

        <div className='space-y-3'>
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

  const renderSliderCaptchaModal = () => {
    return (
      <Modal
        title={t('滑块验证码')}
        visible={sliderCaptchaModalVisible}
        footer={null}
        width={380}
        centered
        maskClosable={!registerLoading}
        onCancel={() => {
          setSliderCaptchaModalVisible(false);
          resetSliderCaptcha();
        }}
      >
        <div className='pb-4'>
          <SliderCaptcha
            t={t}
            onVerified={handleSliderCaptchaVerified}
            resetSignal={sliderCaptchaResetSignal}
          />
        </div>
      </Modal>
    );
  };

  return (
    <AuthShell mode='register'>
      <form className='space-y-5' onSubmit={handleSubmit}>
        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('用户名')}
          </label>
          <input
            type='text'
            name='username'
            autoComplete='username'
            placeholder={t('请输入用户名')}
            className={inputClassName}
            value={inputs.username}
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
            autoComplete='new-password'
            placeholder={t('输入密码，最短 8 位，最长 20 位')}
            className={inputClassName}
            value={inputs.password}
            onChange={(event) => handleChange('password', event.target.value)}
          />
        </div>

        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('确认密码')}
          </label>
          <input
            type='password'
            name='password2'
            autoComplete='new-password'
            placeholder={t('确认密码')}
            className={inputClassName}
            value={inputs.password2}
            onChange={(event) => handleChange('password2', event.target.value)}
          />
        </div>

        {showEmailVerification && (
          <>
            <div>
              <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
                {t('邮箱')}
              </label>
              <div className='flex items-center gap-2'>
                <input
                  type='email'
                  name='email'
                  autoComplete='email'
                  placeholder={t('输入邮箱地址')}
                  className={`${inputClassName} flex-1`}
                  value={inputs.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                />
                <Button
                  type='primary'
                  theme='solid'
                  className={secondaryButtonClassName}
                  onClick={sendVerificationCode}
                  loading={verificationCodeLoading}
                  disabled={disableButton || verificationCodeLoading}
                >
                  {disableButton
                    ? `${t('重新发送')} (${countdown})`
                    : t('获取验证码')}
                </Button>
              </div>
            </div>

            <div>
              <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
                {t('验证码')}
              </label>
              <input
                type='text'
                name='verification_code'
                placeholder={t('输入验证码')}
                className={inputClassName}
                value={inputs.verification_code}
                onChange={(event) =>
                  handleChange('verification_code', event.target.value)
                }
              />
            </div>
          </>
        )}

        <div>
          <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
            {t('推广信息')}
          </label>
          <input
            type='text'
            name='manual_referral'
            placeholder={t('可填写推广链接后缀或推荐口令')}
            className={inputClassName}
            value={inputs.manual_referral}
            onChange={(event) =>
              handleChange('manual_referral', event.target.value)
            }
            maxLength={64}
          />
          {inputs.link_referral && !inputs.manual_referral && (
            <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
              {t('已识别推广链接来源：')}
              {inputs.link_referral}
            </p>
          )}
        </div>

        {renderTerms()}

        <Button
          theme='solid'
          type='primary'
          htmlType='submit'
          className={primaryButtonClassName}
          loading={registerLoading}
          disabled={(hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms}
          icon={<IconUser size='large' />}
        >
          {pageCopy.submitText}
        </Button>
      </form>

      {renderOtherRegisterOptions()}

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
          to={withAllowedReturnTo(pageCopy.switchHref)}
          className='auth-theme-switch-link font-medium'
        >
          {pageCopy.switchText}
        </Link>
      </p>

      {renderWeChatLoginModal()}
      {renderSliderCaptchaModal()}
    </AuthShell>
  );
};

export default RegisterForm;
