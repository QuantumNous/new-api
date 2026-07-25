import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Toast } from 'antd-mobile';
import Turnstile from 'react-turnstile';

import { StatusContext } from '@classic/context/Status';
import { UserContext } from '@classic/context/User';
import { API, updateAPI } from '@classic/helpers/api';
import { setUserData } from '@classic/helpers/data';

import {
  showError,
  showSuccess,
  getSystemName,
  getLogo,
} from '../shims/classic-utils';
import { useAgreementGate } from '../components/AgreementGate';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  const [, userDispatch] = useContext(UserContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  // 2FA 分支：普通登录返回 require_2fa 后切换到验证码输入
  const [require2FA, setRequire2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const { agreementNode, ensureAgreed } = useAgreementGate();

  const status = statusState?.status || {};
  const turnstileEnabled = !!status.turnstile_check;
  const turnstileSiteKey = status.turnstile_site_key || '';

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      Toast.show({ content: '登录已过期，请重新登录' });
    }
  }, []);

  const finishLogin = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    navigate(from, { replace: true });
  };

  const handleSubmit = async () => {
    if (!ensureAgreed()) return;
    if (!username || !password) {
      Toast.show({ content: '请输入用户名和密码' });
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      Toast.show({ content: '请稍候，正在进行安全验证……' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post(
        `/api/user/login?turnstile=${turnstileToken}`,
        { username, password },
      );
      const { success, message, data } = res.data;
      if (success) {
        if (data && data.require_2fa) {
          setRequire2FA(true);
          Toast.show({ content: '请输入两步验证码' });
        } else {
          finishLogin(data);
        }
      } else {
        showError(message);
      }
    } catch (e) {
      // 401/429 等由 showError 统一处理
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handle2FASubmit = async () => {
    if (!twoFACode) {
      Toast.show({ content: '请输入验证码' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post('/api/user/login/2fa', { code: twoFACode });
      const { success, message, data } = res.data;
      if (success) {
        finishLogin(data);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  // 站点名/logo 来自 /api/status 写入的 localStorage，跟随运营配置
  const systemName = status.system_name || getSystemName();
  const logo = status.logo || getLogo();

  return (
    <div className='m-login-bg'>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 72,
          paddingBottom: 32,
        }}
      >
        <img className='m-login-logo' src={logo} alt='logo' />
        <h2 style={{ margin: '18px 0 4px', fontSize: 22 }}>{systemName}</h2>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {require2FA ? '两步验证' : '登录后开始体验'}
        </div>
      </div>
      <div className='m-login-card'>
      {!require2FA ? (
        <Form
          layout='vertical'
          onFinish={handleSubmit}
          footer={
            <Button block color='primary' loading={submitting} type='submit'>
              登录
            </Button>
          }
        >
          <Form.Item label='用户名 / 邮箱'>
            <Input
              placeholder='请输入用户名或邮箱'
              value={username}
              onChange={setUsername}
              name='username'
              autoComplete='username'
            />
          </Form.Item>
          <Form.Item label='密码'>
            <Input
              placeholder='请输入密码'
              type='password'
              value={password}
              onChange={setPassword}
              name='password'
              autoComplete='current-password'
              onEnterPress={handleSubmit}
            />
          </Form.Item>
        </Form>
      ) : (
        <Form
          layout='vertical'
          footer={
            <Button
              block
              color='primary'
              loading={submitting}
              onClick={handle2FASubmit}
            >
              验证并登录
            </Button>
          }
        >
          <Form.Item label='两步验证码'>
            <Input
              placeholder='验证器 6 位数字或备用码'
              value={twoFACode}
              onChange={setTwoFACode}
              onEnterPress={handle2FASubmit}
            />
          </Form.Item>
        </Form>
      )}
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
          color: 'var(--adm-color-weak)',
          fontSize: 13,
          marginTop: 24,
        }}
      >
        没有账户？<Link to='/register'>立即注册</Link> · 找回密码请前往电脑端
      </p>
    </div>
  );
};

export default Login;
