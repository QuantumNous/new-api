import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  setUserData,
  updateAPI,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Icon,
  Modal,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconLock } from '@douyinfe/semi-icons';
import PhoneIcon from '../common/logo/PhoneIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';

const SmsLoginForm = ({ onBack, logo, systemName, isPopupMode, onPopupCallback }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);

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

  useEffect(() => {
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phone) {
      showInfo(t('请输入手机号'));
      return;
    }
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (status?.turnstile_check && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setSending(true);
    try {
      const res = await API.post(
        `/api/sms/send?turnstile=${turnstileToken}`,
        { phone },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功'));
        setCountdown(60);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('验证码发送失败'));
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !code) {
      showInfo(t('请输入手机号和验证码'));
      return;
    }
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (status?.turnstile_check && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setLogging(true);
    try {
      const res = await API.post(
        `/api/user/login/sms?turnstile=${turnstileToken}`,
        { phone, code },
      );
      const { success, message, data } = res.data;
      if (success) {
        if (data && data.require_2fa) {
          setShowTwoFA(true);
          setLogging(false);
          return;
        }
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        updateAPI();
        if (isPopupMode && onPopupCallback) {
          onPopupCallback(data);
        } else {
          showSuccess(t('登录成功！'));
          navigate('/console');
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('登录失败，请重试'));
    } finally {
      setLogging(false);
    }
  };

  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    if (isPopupMode && onPopupCallback) {
      onPopupCallback(data);
    } else {
      showSuccess(t('登录成功！'));
      navigate('/console');
    }
  };

  const handleBackToLogin = () => {
    setShowTwoFA(false);
  };

  return (
    <div className='flex flex-col items-center'>
      <div className='w-full max-w-md'>
        <div className='flex items-center justify-center mb-6 gap-2'>
          <img src={logo} alt='Logo' className='h-10 rounded-full' />
          <Title heading={3}>{systemName}</Title>
        </div>

        <Card className='border-0 !rounded-2xl overflow-hidden'>
          <div className='flex justify-center pt-6 pb-2'>
            <Title heading={3} className='text-gray-800 dark:text-gray-200'>
              {t('短信验证码登录')}
            </Title>
          </div>
          <div className='px-2 py-8'>
            <Form className='space-y-3'>
              <Form.Input
                field='phone'
                label={t('手机号')}
                placeholder={t('请输入手机号')}
                value={phone}
                onChange={(value) => setPhone(value)}
                prefix={<Icon svg={<PhoneIcon />} />}
              />

              <div className='flex gap-2 items-end'>
                <div className='flex-1'>
                  <Form.Input
                    field='code'
                    label={t('验证码')}
                    placeholder={t('请输入验证码')}
                    value={code}
                    onChange={(value) => setCode(value)}
                    prefix={<IconLock />}
                  />
                </div>
                <Button
                  theme='light'
                  type='primary'
                  className='!rounded-full mb-3'
                  style={{ height: '36px', minWidth: '110px' }}
                  onClick={handleSendCode}
                  loading={sending}
                  disabled={countdown > 0}
                >
                  {countdown > 0
                    ? `${countdown}${t('秒后重新获取')}`
                    : t('获取验证码')}
                </Button>
              </div>

              {(hasUserAgreement || hasPrivacyPolicy) && (
                <div className='pt-4'>
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  >
                    <Text size='small' className='text-gray-600'>
                      {t('我已阅读并同意')}
                      {hasUserAgreement && (
                        <a
                          href='/user-agreement'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:text-blue-800 mx-1'
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
                          className='text-blue-600 hover:text-blue-800 mx-1'
                        >
                          {t('隐私政策')}
                        </a>
                      )}
                    </Text>
                  </Checkbox>
                </div>
              )}

              <div className='space-y-2 pt-2'>
                <Button
                  theme='solid'
                  className='w-full !rounded-full'
                  type='primary'
                  htmlType='submit'
                  onClick={handleLogin}
                  loading={logging}
                  disabled={
                    (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                  }
                >
                  {t('登 录')}
                </Button>

                <Button
                  theme='borderless'
                  type='tertiary'
                  className='w-full !rounded-full'
                  onClick={onBack}
                >
                  {t('其他登录选项')}
                </Button>
              </div>
            </Form>

            {status?.turnstile_check && (
              <div className='flex justify-center mt-4'>
                <Turnstile
                  sitekey={status.turnstile_site_key}
                  onVerify={(token) => setTurnstileToken(token)}
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 2FA Modal */}
      <Modal
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
            {t('两步验证')}
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
    </div>
  );
};

export default SmsLoginForm;
