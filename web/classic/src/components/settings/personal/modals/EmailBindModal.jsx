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

import React, { useRef, useCallback } from 'react';
import { Button, Input, Modal } from '@douyinfe/semi-ui';
import { IconMail, IconKey } from '@douyinfe/semi-icons';
import AliyunCaptcha from '../../../common/AliyunCaptcha';
import { useAliyunCaptcha } from '../../../../hooks/useAliyunCaptcha';

const EmailBindModal = ({
  t,
  showEmailBindModal,
  setShowEmailBindModal,
  inputs,
  handleInputChange,
  sendVerificationCode,
  bindEmail,
  disableButton,
  loading,
  countdown,
  status,
}) => {
  const captchaRef = useRef(null);
  const captchaConfig = useAliyunCaptcha(status, 'verification');

  const handleSendCode = useCallback(async () => {
    const email = inputs.email;
    if (!email) return;

    let captchaVerifyParam = '';
    if (captchaConfig.enabled) {
      try {
        captchaVerifyParam = await captchaRef.current?.execute();
        if (!captchaVerifyParam) return;
      } catch {
        return;
      }
    }
    await sendVerificationCode(email, captchaVerifyParam);
  }, [inputs.email, captchaConfig.enabled, sendVerificationCode]);

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
            <IconMail className='mr-2 text-blue-500' />
            {t('绑定邮箱地址')}
          </div>
        }
        visible={showEmailBindModal}
        onCancel={() => setShowEmailBindModal(false)}
        onOk={bindEmail}
        size={'small'}
        centered={true}
        maskClosable={false}
        className='modern-modal'
      >
        <div className='space-y-4 py-4'>
          <div className='flex gap-3'>
            <Input
              placeholder={t('输入邮箱地址')}
              onChange={(value) => handleInputChange('email', value)}
              name='email'
              type='email'
              size='large'
              className='!rounded-lg flex-1'
              prefix={<IconMail />}
            />
            <Button
              onClick={handleSendCode}
              disabled={disableButton || loading}
              className='!rounded-lg'
              type='primary'
              theme='outline'
              size='large'
            >
              {disableButton
                ? `${t('重新发送')} (${countdown})`
                : t('获取验证码')}
            </Button>
          </div>

          <Input
            placeholder={t('验证码')}
            name='email_verification_code'
            value={inputs.email_verification_code}
            onChange={(value) =>
              handleInputChange('email_verification_code', value)
            }
            size='large'
            className='!rounded-lg'
            prefix={<IconKey />}
          />
        </div>
      </Modal>
    </>
  );
};

export default EmailBindModal;
