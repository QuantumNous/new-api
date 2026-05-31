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

import React, { useCallback, useEffect, useState } from 'react';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  getSystemName,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Form, Typography } from '@douyinfe/semi-ui';
import { IconMail } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CaptchaWidget from '../common/CaptchaWidget';

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
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefresh, setCaptchaRefresh] = useState(0);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const logo = getLogo();
  const systemName = getSystemName();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const handleResize = useCallback(() => setIsMobile(window.innerWidth < 768), []);
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      } else if (status.register_captcha) {
        setCaptchaEnabled(true);
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

  const handleCaptchaChange = ({ captchaId: id, captchaAnswer: ans }) => {
    setCaptchaId(id);
    setCaptchaAnswer(ans);
  };

  async function handleSubmit(e) {
    if (!email) {
      showError(t('请输入邮箱地址'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    if (captchaEnabled && captchaAnswer === '') {
      showInfo(t('请输入图形验证码'));
      return;
    }
    setDisableButton(true);
    setLoading(true);
    const res = await API.get(
      `/api/reset_password?email=${email}&turnstile=${turnstileToken}&captcha_id=${encodeURIComponent(captchaId)}&captcha_answer=${encodeURIComponent(captchaAnswer)}`,
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('重置邮件发送成功，请检查邮箱！'));
      setInputs({ ...inputs, email: '' });
    } else {
      showError(message);
    }
    setLoading(false);
    // 提交会消费图形验证码（成功时），刷新以便再次提交
    if (captchaEnabled) setCaptchaRefresh((n) => n + 1);
  }

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
            <div style={{ marginBottom: 32 }}>
              <Title heading={3} style={{ marginBottom: 6, color: 'var(--semi-color-text-0)' }}>{t('密码重置')}</Title>
              <Text type='tertiary' style={{ fontSize: 14 }}>{t('输入邮箱地址，我们将发送重置链接')}</Text>
            </div>
            <Form>
              <Form.Input
                field='email'
                label={t('邮箱')}
                placeholder={t('请输入您的邮箱地址')}
                name='email'
                value={email}
                onChange={handleChange}
                prefix={<IconMail />}
              />

              {captchaEnabled && (
                <CaptchaWidget
                  answer={captchaAnswer}
                  onChange={handleCaptchaChange}
                  refreshSignal={captchaRefresh}
                />
              )}

              <div style={{ marginTop: 16 }}>
                <Button
                  theme='solid'
                  type='primary'
                  htmlType='submit'
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={disableButton}
                  style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(99,102,241,0.28)' }}
                >
                  {disableButton
                    ? `${t('重试')} (${countdown})`
                    : t('提交')}
                </Button>
              </div>
            </Form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Text style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>
                {t('想起来了？')}{' '}
                <Link to='/login' style={{ color: 'var(--semi-color-primary)', fontWeight: 600 }}>{t('登录')}</Link>
              </Text>
            </div>
          </div>
        </div>
      </div>
      {turnstileEnabled && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999 }}><Turnstile sitekey={turnstileSiteKey} onVerify={(token) => { setTurnstileToken(token); }} /></div>}
    </div>
  );
};

export default PasswordResetForm;
