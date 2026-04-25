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
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  getSystemName,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import {
  AuthBrand,
  AuthLinkRow,
  AuthPage,
  AuthPanel,
  AuthPrimaryButton,
  AuthTextField,
} from './AuthLayout';

const PasswordResetForm = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    email: '',
  });
  const { email } = inputs;

  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const logo = getLogo();
  const systemName = getSystemName();

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  }, []);

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
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  function handleChange(value) {
    setInputs((inputs) => ({ ...inputs, email: value }));
  }

  async function handleSubmit(e) {
    if (!email) {
      showError(t('请输入邮箱地址'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setDisableButton(true);
    setLoading(true);
    const res = await API.get(
      `/api/reset_password?email=${email}&turnstile=${turnstileToken}`,
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('重置邮件发送成功，请检查邮箱！'));
      setInputs({ ...inputs, email: '' });
    } else {
      showError(message);
    }
    setLoading(false);
  }

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
      <AuthBrand logo={logo} systemName={systemName} />
      <AuthPanel
        title={t('密码重置')}
        subtitle={t('输入注册邮箱，我们会向你发送重置密码邮件。')}
      >
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <AuthTextField
            label={t('邮箱')}
            placeholder={t('请输入您的邮箱地址')}
            name='email'
            value={email}
            onChange={(event) => handleChange(event.target.value)}
            icon={<Mail size={18} />}
          />

          <div className='pt-2'>
            <AuthPrimaryButton
              onPress={handleSubmit}
              isPending={loading}
              isDisabled={disableButton}
            >
              {disableButton ? `${t('重试')} (${countdown})` : t('提交')}
            </AuthPrimaryButton>
          </div>
        </form>

        <AuthLinkRow prefix={t('想起来了？')} linkText={t('登录')} to='/login' />
      </AuthPanel>
    </AuthPage>
  );
};

export default PasswordResetForm;
