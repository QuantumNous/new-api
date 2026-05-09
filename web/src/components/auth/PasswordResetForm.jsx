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
import { API, showError, showInfo, showSuccess } from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Card, Form, Typography } from '@douyinfe/semi-ui';
import { IconMail } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from './AuthLayout';

const { Text, Title } = Typography;

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
    <AuthLayout
      variant='reset'
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
      <Card className='auth-card-shell auth-reset-card'>
        <div className='auth-card-body'>
          <div className='auth-card-header'>
            <div className='auth-card-heading-row'>
              <span className='auth-card-heading-mark'>✦</span>
              <Title heading={3} className='auth-card-title'>
                {t('重置密码')}
              </Title>
            </div>
            <Text className='auth-card-subtitle'>
              {t('输入邮箱后，我们会向你发送密码重置链接。')}
            </Text>
          </div>

          <Form className='auth-form-stack'>
            <Form.Input
              className='auth-input'
              field='email'
              label={t('邮箱')}
              placeholder={t('请输入您的邮箱地址')}
              name='email'
              value={email}
              onChange={handleChange}
              prefix={<IconMail />}
            />

            <Button
              theme='solid'
              className='auth-primary-button'
              type='primary'
              htmlType='submit'
              onClick={handleSubmit}
              loading={loading}
              disabled={disableButton}
            >
              {disableButton ? `${t('重试')} (${countdown})` : t('提交')}
            </Button>
          </Form>

          <div className='auth-switch-row text-sm'>
            <Text>
              {t('想起来了？')}{' '}
              <Link to='/login' className='auth-switch-link'>
                {t('登录')}
              </Link>
            </Text>
          </div>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default PasswordResetForm;
