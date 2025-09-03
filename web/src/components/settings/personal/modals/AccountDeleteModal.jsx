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
import { Banner, Input, Modal, Typography } from '@douyinfe/semi-ui';
import { IconDelete, IconUser } from '@douyinfe/semi-icons';
import Turnstile from 'react-turnstile';

const AccountDeleteModal = ({
  t,
  showAccountDeleteModal,
  setShowAccountDeleteModal,
  inputs,
  handleInputChange,
  deleteAccount,
  userState,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
    <Modal
      title={
        <div className='flex items-center'>
          <IconDelete className='mr-2 text-red-500' />
          {t('删除账户确认')}
        </div>
      }
      visible={showAccountDeleteModal}
      onCancel={() => setShowAccountDeleteModal(false)}
      onOk={deleteAccount}
      size={'small'}
      centered={true}
      className='modern-modal'
    >
      <div className='space-y-4 py-4'>
        <Banner
          type='danger'
          description={t('您正在删除自己的帐户，将清空所有数据且不可恢复')}
          closeIcon={null}
          className='!rounded-lg'
        />

        <div>
          <Typography.Text strong className='block mb-2 text-red-600'>
            {t('请输入您的用户名以确认删除')}
          </Typography.Text>
          <Input
            placeholder={t('输入你的账户名{{username}}以确认删除', {
              username: ` ${userState?.user?.username} `,
            })}
            name='self_account_deletion_confirmation'
            value={inputs.self_account_deletion_confirmation}
            onChange={(value) =>
              handleInputChange('self_account_deletion_confirmation', value)
            }
            size='large'
            className='!rounded-lg'
            prefix={<IconUser />}
          />
        </div>

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

export default AccountDeleteModal;
