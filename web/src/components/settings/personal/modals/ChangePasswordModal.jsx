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
import { Input, Modal, Typography } from '@douyinfe/semi-ui';
import { IconLock } from '@douyinfe/semi-icons';
import Turnstile from 'react-turnstile';

const ChangePasswordModal = ({
  t,
  showChangePasswordModal,
  setShowChangePasswordModal,
  inputs,
  handleInputChange,
  changePassword,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
    <Modal
      title={
        <div className='personal-settings-modal-title-row'>
          <IconLock className='personal-settings-modal-title-icon' />
          <div>
            <div className='personal-settings-modal-title'>{t('修改密码')}</div>
            <div className='personal-settings-modal-subtitle'>
              {t('更新登录密码以提升账户安全性')}
            </div>
          </div>
        </div>
      }
      visible={showChangePasswordModal}
      onCancel={() => setShowChangePasswordModal(false)}
      onOk={changePassword}
      okText={t('保存密码')}
      cancelText={t('取消')}
      okButtonProps={{ className: 'personal-settings-primary-button' }}
      cancelButtonProps={{ className: 'personal-settings-outline-button' }}
      size={'small'}
      centered={true}
      className='personal-settings-modal'
    >
      <div className='personal-settings-modal-body'>
        <div className='personal-settings-modal-field'>
          <Typography.Text strong className='personal-settings-modal-label'>
            {t('原密码')}
          </Typography.Text>
          <Input
            name='original_password'
            placeholder={t('请输入原密码')}
            type='password'
            value={inputs.original_password}
            onChange={(value) => handleInputChange('original_password', value)}
            size='large'
            className='personal-settings-modal-input'
            prefix={<IconLock />}
          />
        </div>

        <div className='personal-settings-modal-field'>
          <Typography.Text strong className='personal-settings-modal-label'>
            {t('新密码')}
          </Typography.Text>
          <Input
            name='set_new_password'
            placeholder={t('请输入新密码')}
            type='password'
            value={inputs.set_new_password}
            onChange={(value) => handleInputChange('set_new_password', value)}
            size='large'
            className='personal-settings-modal-input'
            prefix={<IconLock />}
          />
        </div>

        <div className='personal-settings-modal-field'>
          <Typography.Text strong className='personal-settings-modal-label'>
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
            className='personal-settings-modal-input'
            prefix={<IconLock />}
          />
        </div>

        {turnstileEnabled && (
          <div className='personal-settings-modal-captcha'>
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

export default ChangePasswordModal;
