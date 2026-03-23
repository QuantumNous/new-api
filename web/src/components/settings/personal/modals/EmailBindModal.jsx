import React from 'react';
import { Button, Input, Modal } from '@douyinfe/semi-ui';
import { IconMail, IconKey } from '@douyinfe/semi-icons';
import Turnstile from 'react-turnstile';

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
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
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
            onClick={sendVerificationCode}
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

        {turnstileEnabled && (
          <div className='flex justify-center'>
            <Turnstile
              sitekey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EmailBindModal;
