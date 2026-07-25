import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Toast } from 'antd-mobile';
import Turnstile from 'react-turnstile';

import { StatusContext } from '@classic/context/Status';
import { UserContext } from '@classic/context/User';
import { API, updateAPI } from '@classic/helpers/api';
import { setUserData } from '@classic/helpers/data';

import {
  getLogo,
  getSystemName,
  showError,
  showSuccess,
} from '../shims/classic-utils';
import { useAgreementGate } from '../components/AgreementGate';

const Register = () => {
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);
  const [, userDispatch] = useContext(UserContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const { agreementNode, ensureAgreed } = useAgreementGate();

  const status = statusState?.status || {};
  const emailVerification = !!status.email_verification;
  const turnstileEnabled = !!status.turnstile_check;
  const turnstileSiteKey = status.turnstile_site_key || '';
  // 邀请码从 ?aff= 带入（分享链接场景）
  const affCode = new URLSearchParams(window.location.search).get('aff') || '';

  const sendCode = async () => {
    if (!email.trim()) {
      Toast.show({ content: '请先填写邮箱' });
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      Toast.show({ content: '请稍候，正在进行安全验证……' });
      return;
    }
    setCodeSending(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(email.trim())}&turnstile=${turnstileToken}`,
      );
      if (res.data.success) {
        showSuccess('验证码已发送，请查收邮箱');
        setCodeCooldown(60);
        const timer = setInterval(() => {
          setCodeCooldown((s) => {
            if (s <= 1) {
              clearInterval(timer);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    } finally {
      setCodeSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!ensureAgreed()) return;
    if (!username.trim() || !password) {
      Toast.show({ content: '请填写用户名和密码' });
      return;
    }
    if (password.length < 8) {
      showError('密码长度至少 8 位');
      return;
    }
    if (password !== password2) {
      showError('两次输入的密码不一致');
      return;
    }
    if (emailVerification && (!email.trim() || !verificationCode.trim())) {
      showError('请填写邮箱并完成验证码校验');
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      Toast.show({ content: '请稍候，正在进行安全验证……' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post(`/api/user/register?turnstile=${turnstileToken}`, {
        username: username.trim(),
        password,
        password2,
        email: email.trim(),
        verification_code: verificationCode.trim(),
        aff_code: affCode,
      });
      const { success, message } = res.data;
      if (success) {
        // 注册成功后直接走一次登录，免得用户再输一遍
        const loginRes = await API.post(
          `/api/user/login?turnstile=${turnstileToken}`,
          { username: username.trim(), password },
        );
        if (loginRes.data.success && !loginRes.data.data?.require_2fa) {
          userDispatch({ type: 'login', payload: loginRes.data.data });
          setUserData(loginRes.data.data);
          updateAPI();
          showSuccess('注册成功！');
          navigate('/', { replace: true });
        } else {
          showSuccess('注册成功，请登录');
          navigate('/login', { replace: true });
        }
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='m-login-bg'>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 56,
          paddingBottom: 24,
        }}
      >
        <img className='m-login-logo' src={getLogo()} alt='logo' />
        <h2 style={{ margin: '16px 0 4px', fontSize: 22 }}>{getSystemName()}</h2>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>创建新账户</div>
      </div>
      <div className='m-login-card'>
        <Form
          layout='vertical'
          onFinish={handleSubmit}
          footer={
            <Button block color='primary' loading={submitting} type='submit'>
              注册
            </Button>
          }
        >
          <Form.Item label='用户名'>
            <Input
              placeholder='请输入用户名'
              value={username}
              onChange={setUsername}
              name='username'
              autoComplete='username'
            />
          </Form.Item>
          <Form.Item label='密码'>
            <Input
              type='password'
              placeholder='至少 8 位'
              value={password}
              onChange={setPassword}
              name='new-password'
              autoComplete='new-password'
            />
          </Form.Item>
          <Form.Item label='确认密码'>
            <Input
              type='password'
              placeholder='再次输入密码'
              value={password2}
              onChange={setPassword2}
              autoComplete='new-password'
            />
          </Form.Item>
          {emailVerification && (
            <>
              <Form.Item label='邮箱'>
                <Input
                  placeholder='用于接收验证码'
                  value={email}
                  onChange={setEmail}
                  autoComplete='email'
                />
              </Form.Item>
              <Form.Item
                label='邮箱验证码'
                extra={
                  <Button
                    size='small'
                    fill='none'
                    color='primary'
                    disabled={codeCooldown > 0}
                    loading={codeSending}
                    onClick={sendCode}
                  >
                    {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                  </Button>
                }
              >
                <Input
                  placeholder='请输入验证码'
                  value={verificationCode}
                  onChange={setVerificationCode}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </div>
      {agreementNode}
      {turnstileEnabled && turnstileSiteKey && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Turnstile
            sitekey={turnstileSiteKey}
            onVerify={(token) => setTurnstileToken(token)}
          />
        </div>
      )}
      <p
        style={{
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 13,
          marginTop: 20,
        }}
      >
        已有账户？<Link to='/login'>去登录</Link>
      </p>
    </div>
  );
};

export default Register;
