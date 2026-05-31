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

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import {
  IconGithubLogo,
  IconMail,
  IconUser,
  IconLock,
  IconKey,
} from '@douyinfe/semi-icons';
import {
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
} from '../../helpers';
import OIDCIcon from '../common/logo/OIDCIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import CaptchaWidget from '../common/CaptchaWidget';
import TelegramLoginButton from 'react-telegram-login/src';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const RegisterForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: t('使用 GitHub 继续'),
    redirecting: t('正在跳转 GitHub...'),
    timeout: t('请求超时，请刷新页面后重新发起 GitHub 登录'),
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
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefresh, setCaptchaRefresh] = useState(0);
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
  const githubButtonText = githubButtonTextKeyByState[githubButtonState];

  const logo = getLogo();
  const systemName = getSystemName();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const handleResize = useCallback(() => setIsMobile(window.innerWidth < 768), []);
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

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
    } else if (status?.register_captcha) {
      // 与 Turnstile 互斥：Turnstile 优先，未启用时才展示图形验证码
      setCaptchaEnabled(true);
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

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  const handleCaptchaChange = ({ captchaId: id, captchaAnswer: ans }) => {
    setCaptchaId(id);
    setCaptchaAnswer(ans);
  };

  async function handleSubmit(e) {
    if (password.length < 8) {
      showInfo(t('密码长度不得小于 8 位！'));
      return;
    }
    if (password !== password2) {
      showInfo(t('两次输入的密码不一致'));
      return;
    }
    if (username && password) {
      if (turnstileEnabled && turnstileToken === '') {
        showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
        return;
      }
      if (captchaEnabled && captchaAnswer === '') {
        showInfo(t('请输入图形验证码'));
        return;
      }
      setRegisterLoading(true);
      try {
        if (!affCode) {
          affCode = localStorage.getItem('aff');
        }
        inputs.aff_code = affCode;
        const res = await API.post(
          `/api/user/register?turnstile=${turnstileToken}&captcha_id=${encodeURIComponent(captchaId)}&captcha_answer=${encodeURIComponent(captchaAnswer)}`,
          inputs,
        );
        const { success, message } = res.data;
        if (success) {
          navigate('/login');
          showSuccess(t('注册成功！'));
        } else {
          showError(message);
          if (captchaEnabled) setCaptchaRefresh((n) => n + 1);
        }
      } catch (error) {
        showError(t('注册失败，请重试'));
        if (captchaEnabled) setCaptchaRefresh((n) => n + 1);
      } finally {
        setRegisterLoading(false);
      }
    }
  }

  const sendVerificationCode = async () => {
    if (inputs.email === '') return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    if (captchaEnabled && captchaAnswer === '') {
      showInfo(t('请输入图形验证码'));
      return;
    }
    setVerificationCodeLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(inputs.email)}&turnstile=${turnstileToken}&captcha_id=${encodeURIComponent(captchaId)}&captcha_answer=${encodeURIComponent(captchaAnswer)}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功，请检查你的邮箱！'));
        setDisableButton(true); // 发送成功后禁用按钮，开始倒计时
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('发送验证码失败，请重试'));
    } finally {
      setVerificationCodeLoading(false);
      // 验证码发送会消费图形验证码，刷新以便后续注册步骤使用新验证码
      if (captchaEnabled) setCaptchaRefresh((n) => n + 1);
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

  const renderOAuthOptions = () => {
    const btn = {
      width: '100%', height: 44, borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 14, fontWeight: 500, cursor: 'pointer',
      border: '1px solid var(--semi-color-border)',
      background: 'var(--semi-color-bg-1)',
      color: 'var(--semi-color-text-0)',
      transition: 'all 150ms ease',
    };
    const hoverOn = e => { e.currentTarget.style.borderColor = 'var(--semi-color-primary)'; e.currentTarget.style.background = 'var(--semi-color-fill-0)'; };
    const hoverOff = e => { e.currentTarget.style.borderColor = 'var(--semi-color-border)'; e.currentTarget.style.background = 'var(--semi-color-bg-1)'; };

    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <Title heading={3} style={{ marginBottom: 6, color: 'var(--semi-color-text-0)' }}>{t('注 册')}</Title>
          <Text type='tertiary' style={{ fontSize: 14 }}>{t('创建你的账户，即刻开始使用')}</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {status.wechat_login && <Button theme='outline' type='tertiary' style={btn} icon={<Icon svg={<WeChatIcon />} size='small' />} onClick={onWeChatLoginClicked} loading={wechatLoading} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('使用 微信 继续')}</Button>}
          {status.github_oauth && <Button theme='outline' type='tertiary' style={btn} icon={<IconGithubLogo size='small' />} onClick={handleGitHubClick} loading={githubLoading} disabled={githubButtonDisabled} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{githubButtonText}</Button>}
          {status.discord_oauth && <Button theme='outline' type='tertiary' style={btn} icon={<Icon svg={<SiDiscord style={{ width: 16, height: 16 }} />} />} onClick={handleDiscordClick} loading={discordLoading} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('使用 Discord 继续')}</Button>}
          {status.oidc_enabled && <Button theme='outline' type='tertiary' style={btn} icon={<Icon svg={<OIDCIcon />} size='small' />} onClick={handleOIDCClick} loading={oidcLoading} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('使用 OIDC 继续')}</Button>}
          {status.linuxdo_oauth && <Button theme='outline' type='tertiary' style={btn} icon={<Icon svg={<LinuxDoIcon style={{ width: 16, height: 16 }} />} />} onClick={handleLinuxDOClick} loading={linuxdoLoading} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('使用 LinuxDO 继续')}</Button>}
          {status.custom_oauth_providers && status.custom_oauth_providers.map((provider) => <Button key={provider.slug} theme='outline' type='tertiary' style={btn} icon={getOAuthProviderIcon(provider.icon || '', 16)} onClick={() => handleCustomOAuthClick(provider)} loading={customOAuthLoading[provider.slug]} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('使用 {{name}} 继续', { name: provider.name })}</Button>)}
          {status.telegram_oauth && <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}><TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} /></div>}
          <Divider margin='4px' align='center' style={{ color: 'var(--semi-color-text-3)' }}>{t('或')}</Divider>
          <button type='button' onClick={handleEmailRegisterClick} disabled={emailRegisterLoading} style={{ ...btn, border: 'none', background: 'var(--semi-color-primary)', color: '#fff', fontWeight: 600, boxShadow: '0 4px 16px rgba(99,102,241,0.28)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--semi-color-primary-hover)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--semi-color-primary)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.28)'; }}><IconMail size='small' />{t('使用 用户名 注册')}</button>
        </div>
        <Text style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>{t('已有账户？')} <Link to='/login' style={{ color: 'var(--semi-color-primary)', fontWeight: 600 }}>{t('登录')}</Link></Text>
      </div>
    );
  };

  const renderEmailRegisterForm = () => {
    const btnOutline = { width: '100%', height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-1)', color: 'var(--semi-color-text-0)', transition: 'all 150ms ease' };
    const hoverOn = e => { e.currentTarget.style.borderColor = 'var(--semi-color-primary)'; e.currentTarget.style.background = 'var(--semi-color-fill-0)'; };
    const hoverOff = e => { e.currentTarget.style.borderColor = 'var(--semi-color-border)'; e.currentTarget.style.background = 'var(--semi-color-bg-1)'; };

    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <Title heading={3} style={{ marginBottom: 6, color: 'var(--semi-color-text-0)' }}>{t('注 册')}</Title>
          <Text type='tertiary' style={{ fontSize: 14 }}>{t('创建你的账户，即刻开始使用')}</Text>
        </div>
        <Form style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Form.Input field='username' label={t('用户名')} placeholder={t('请输入用户名')} name='username' onChange={(value) => handleChange('username', value)} prefix={<IconUser />} />
          <Form.Input field='password' label={t('密码')} placeholder={t('输入密码，最短 8 位，最长 20 位')} name='password' mode='password' onChange={(value) => handleChange('password', value)} prefix={<IconLock />} />
          <Form.Input field='password2' label={t('确认密码')} placeholder={t('确认密码')} name='password2' mode='password' onChange={(value) => handleChange('password2', value)} prefix={<IconLock />} />
          {showEmailVerification && (<>
            <Form.Input field='email' label={t('邮箱')} placeholder={t('输入邮箱地址')} name='email' type='email' onChange={(value) => handleChange('email', value)} prefix={<IconMail />} suffix={<Button onClick={sendVerificationCode} loading={verificationCodeLoading} disabled={disableButton || verificationCodeLoading}>{disableButton ? `${t('重新发送')} (${countdown})` : t('获取验证码')}</Button>} />
            <Form.Input field='verification_code' label={t('验证码')} placeholder={t('输入验证码')} name='verification_code' onChange={(value) => handleChange('verification_code', value)} prefix={<IconKey />} />
          </>)}
          {captchaEnabled && (
            <CaptchaWidget answer={captchaAnswer} onChange={handleCaptchaChange} refreshSignal={captchaRefresh} />
          )}
          {(hasUserAgreement || hasPrivacyPolicy) && (
            <div style={{ paddingTop: 4 }}>
              <Checkbox checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}>
                <Text size='small' style={{ color: 'var(--semi-color-text-2)' }}>
                  {t('我已阅读并同意')}
                  {hasUserAgreement && <a href='/user-agreement' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--semi-color-primary)', margin: '0 3px', fontWeight: 500 }}>{t('用户协议')}</a>}
                  {hasUserAgreement && hasPrivacyPolicy && t('和')}
                  {hasPrivacyPolicy && <a href='/privacy-policy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--semi-color-primary)', margin: '0 3px', fontWeight: 500 }}>{t('隐私政策')}</a>}
                </Text>
              </Checkbox>
            </div>
          )}
          <button type='button' onClick={handleSubmit} disabled={registerLoading || ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: 'var(--semi-color-primary)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.28)', transition: 'all 200ms ease' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--semi-color-primary-hover)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--semi-color-primary)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.28)'; }}>{t('注册')}</button>
        </Form>
        {hasOAuthRegisterOptions && (<>
          <Divider margin='20px' align='center' style={{ color: 'var(--semi-color-text-3)' }}>{t('或')}</Divider>
          <button type='button' onClick={handleOtherRegisterOptionsClick} disabled={otherRegisterOptionsLoading} style={{ ...btnOutline }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{t('其他注册选项')}</button>
        </>)}
        <div style={{ marginTop: 24 }}><Text style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>{t('已有账户？')} <Link to='/login' style={{ color: 'var(--semi-color-primary)', fontWeight: 600 }}>{t('登录')}</Link></Text></div>
      </div>
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
          <img src={status.wechat_qrcode} alt={t('微信二维码')} className='mb-4' />
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

  return (
    <div style={{ display: 'flex', minHeight: isMobile ? 'auto' : '100vh', background: 'var(--semi-color-bg-0)' }}>
      {!isMobile && (
      <div style={{
        flex: '0 0 46%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '64px 48px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(99,102,241,0.04) 0%, rgba(139,92,246,0.02) 40%, var(--semi-color-bg-0) 100%)',
        borderRight: '1px solid var(--semi-color-border)',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(circle, var(--semi-color-text-0) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          <img src={logo} alt='Logo' style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 28px', display: 'block', boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }} />
          <Title heading={2} style={{ marginBottom: 12, color: 'var(--semi-color-text-0)', fontWeight: 700 }}>{systemName}</Title>
          <Text type='tertiary' style={{ fontSize: 15, lineHeight: '26px' }}>{t('高性价比的Enterprise企业级API转发服务，AI模型All In One！完全兼容各平台接口协议，零开发基础无缝对接各种应用。')}</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 40, textAlign: 'left' }}>
            {[
              { text: t('100+ AI 模型，一个 API 接入') },
              { text: t('企业级安全，数据仅转发不保存') },
              { text: t('全球 CDN 加速，低延迟响应') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--semi-color-text-2)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--semi-color-primary)', flexShrink: 0, opacity: 0.6 }} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? '66px 16px' : '48px', background: 'var(--semi-color-bg-0)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ background: 'var(--semi-color-bg-1)', borderRadius: 16, padding: isMobile ? '32px 20px' : '40px 36px', border: '1px solid var(--semi-color-border)', boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 4px 20px rgba(15,23,42,0.03)' }}>
            {showEmailRegister || !hasOAuthRegisterOptions ? renderEmailRegisterForm() : renderOAuthOptions()}
          </div>
        </div>
      </div>
      {renderWeChatLoginModal()}
      {turnstileEnabled && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999 }}><Turnstile sitekey={turnstileSiteKey} onVerify={(token) => { setTurnstileToken(token); }} /></div>}
    </div>
  );
};

export default RegisterForm;
