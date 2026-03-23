import React from 'react';
import { Button, Input, Modal, Image } from '@douyinfe/semi-ui';
import { IconKey } from '@douyinfe/semi-icons';
import { SiWechat } from 'react-icons/si';

const WeChatBindModal = ({
  t,
  showWeChatBindModal,
  setShowWeChatBindModal,
  inputs,
  handleInputChange,
  bindWeChat,
  status,
}) => {
  return (
    <Modal
      title={
        <div className='flex items-center'>
          <SiWechat className='mr-2 text-green-500' size={20} />
          {t('绑定微信账户')}
        </div>
      }
      visible={showWeChatBindModal}
      onCancel={() => setShowWeChatBindModal(false)}
      footer={null}
      size={'small'}
      centered={true}
      className='modern-modal'
    >
      <div className='space-y-4 py-4 text-center'>
        <Image src={status.wechat_qrcode} className='mx-auto' />
        <div className='text-gray-600'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>
        <Input
          placeholder={t('验证码')}
          name='wechat_verification_code'
          value={inputs.wechat_verification_code}
          onChange={(v) => handleInputChange('wechat_verification_code', v)}
          size='large'
          className='!rounded-lg'
          prefix={<IconKey />}
        />
        <Button
          type='primary'
          theme='solid'
          size='large'
          onClick={bindWeChat}
          className='!rounded-lg w-full !bg-slate-600 hover:!bg-slate-700'
          icon={<SiWechat size={16} />}
        >
          {t('绑定')}
        </Button>
      </div>
    </Modal>
  );
};

export default WeChatBindModal;
