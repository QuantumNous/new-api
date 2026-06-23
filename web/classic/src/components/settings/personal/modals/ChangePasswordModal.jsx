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

import React, { useState, useRef, useCallback } from 'react';
import { Button, Input, Modal, Typography } from '@douyinfe/semi-ui';
import { IconLock, IconMail, IconKey } from '@douyinfe/semi-icons';
import AliyunCaptcha from '../../../common/AliyunCaptcha';
import { useAliyunCaptcha } from '../../../../hooks/useAliyunCaptcha';

const ChangePasswordModal = ({
  t,
  showChangePasswordModal,
  setShowChangePasswordModal,
  inputs,
  handleInputChange,
  changePassword,
  sendVerificationCode,
  status,
  userState,
}) => {
  const [emailCode, setEmailCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const captchaRef = useRef(null);
  const captchaConfig = useAliyunCaptcha(status, 'verification');

  const hasEmail = Boolean(userState?.user?.email);
  const needsEmailVerification = hasEmail;

  // Countdown timer for code resend
  React.useEffect(() => {
    let interval = null;
    if (codeSent && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCodeSent(false);
      setCountdown(30);
    }
    return () => clearInterval(interval);
  }, [codeSent, countdown]);

  const handleSendCode = useCallback(async () => {
    if (!hasEmail) return;
    setSendingCode(true);
    try {
      let captchaVerifyParam = '';
      if (captchaConfig.enabled) {
        try {
          captchaVerifyParam = await captchaRef.current?.execute();
          if (!captchaVerifyParam) {
            setSendingCode(false);
            return;
          }
        } catch {
          setSendingCode(false);
          return;
        }
      }
      await sendVerificationCode(userState.user.email, captchaVerifyParam);
      setCodeSent(true);
    } finally {
      setSendingCode(false);
    }
  }, [hasEmail, captchaConfig.enabled, sendVerificationCode, userState]);

  const handleSubmit = useCallback(() => {
    if (needsEmailVerification && !emailCode) return;
    changePassword(
      needsEmailVerification
        ? {
            email: userState.user.email,
            verification_code: emailCode,
          }
        : undefined,
    );
  }, [needsEmailVerification, emailCode, changePassword, userState]);

  const emaillessMessage = hasEmail
    ? null
    : t('请先绑定邮箱地址后修改密码');

  return (
    <>
      <AliyunCaptcha
        ref={captchaRef}
        enabled={captchaConfig.enabled}
        region={captchaConfig.region}
        prefix={captchaConfig.prefix}
        sceneId={captchaConfig.sceneId}
      />

      <Modal
        title={
          <div className='flex items-center'>
            <IconLock className='mr-2 text-orange-500' />
            {t('修改密码')}
          </div>
        }
        visible={showChangePasswordModal}
        onCancel={() => setShowChangePasswordModal(false)}
        onOk={handleSubmit}
        size={'small'}
        centered={true}
        className='modern-modal'
        okButtonProps={{
          disabled:
            !hasEmail || (needsEmailVerification && !emailCode),
        }}
      >
        <div className='space-y-4 py-4'>
          {!hasEmail && (
            <div className='p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400'>
              {emaillessMessage}
            </div>
          )}

          {hasEmail && (
            <div>
              <Typography.Text strong className='block mb-2'>
                {t('邮箱验证码')}
              </Typography.Text>
              <div className='flex gap-3'>
                <Input
                  placeholder={t('验证码')}
                  value={emailCode}
                  onChange={(value) => setEmailCode(value)}
                  size='large'
                  className='!rounded-lg flex-1'
                  prefix={<IconKey />}
                />
                <Button
                  onClick={handleSendCode}
                  disabled={sendingCode || codeSent}
                  loading={sendingCode}
                  className='!rounded-lg'
                  type='primary'
                  theme='outline'
                  size='large'
                >
                  {codeSent
                    ? `${t('重新发送')} (${countdown})`
                    : sendingCode
                      ? t('发送中...')
                      : t('获取验证码')}
                </Button>
              </div>
            </div>
          )}

          <div>
            <Typography.Text strong className='block mb-2'>
              {t('原密码')}
            </Typography.Text>
            <Input
              name='original_password'
              placeholder={t('请输入原密码')}
              type='password'
              value={inputs.original_password}
              onChange={(value) => handleInputChange('original_password', value)}
              size='large'
              className='!rounded-lg'
              prefix={<IconLock />}
            />
          </div>

          <div>
            <Typography.Text strong className='block mb-2'>
              {t('新密码')}
            </Typography.Text>
            <Input
              name='set_new_password'
              placeholder={t('请输入新密码')}
              type='password'
              value={inputs.set_new_password}
              onChange={(value) => handleInputChange('set_new_password', value)}
              size='large'
              className='!rounded-lg'
              prefix={<IconLock />}
            />
          </div>

          <div>
            <Typography.Text strong className='block mb-2'>
              {t('确认新密码')}
            </Typography.Text>
            <Input
              name='set_new_password_confirmation'
              placeholder={t('请再次输入新密码')}
              type='password'
              value={inputs.set_new_password_confirmation}
              onChange={(value) =>
                handleInputChange('set_new_password_confirmation', value)
              }
              size='large'
              className='!rounded-lg'
              prefix={<IconLock />}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ChangePasswordModal;
