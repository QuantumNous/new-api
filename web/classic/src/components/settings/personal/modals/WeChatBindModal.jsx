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
        <div className='personal-settings-modal-title-row'>
          <SiWechat className='personal-settings-modal-title-icon' size={20} />
          <div>
            <div className='personal-settings-modal-title'>
              {t('绑定微信账户')}
            </div>
            <div className='personal-settings-modal-subtitle'>
              {t('扫码关注后输入验证码完成绑定')}
            </div>
          </div>
        </div>
      }
      visible={showWeChatBindModal}
      onCancel={() => setShowWeChatBindModal(false)}
      footer={null}
      size={'small'}
      centered={true}
      className='personal-settings-modal'
    >
      <div className='personal-settings-modal-body text-center'>
        <div className='personal-settings-modal-image-card'>
          <Image src={status.wechat_qrcode} className='mx-auto' />
        </div>
        <div className='personal-settings-modal-helper'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>
        <div className='personal-settings-modal-field text-left'>
          <div className='personal-settings-modal-label'>{t('验证码')}</div>
          <Input
            placeholder={t('输入验证码')}
            name='wechat_verification_code'
            value={inputs.wechat_verification_code}
            onChange={(v) => handleInputChange('wechat_verification_code', v)}
            size='large'
            className='personal-settings-modal-input'
            prefix={<IconKey />}
          />
        </div>
        <Button
          type='primary'
          theme='solid'
          size='large'
          onClick={bindWeChat}
          className='personal-settings-primary-button w-full'
          icon={<SiWechat size={16} />}
        >
          {t('绑定')}
        </Button>
      </div>
    </Modal>
  );
};

export default WeChatBindModal;
