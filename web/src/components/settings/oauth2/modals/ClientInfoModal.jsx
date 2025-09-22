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
import { Modal, Banner, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ClientInfoModal = ({ visible, onClose, clientId, clientSecret }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('客户端创建成功')}
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      cancelText=''
      okText={t('我已复制保存')}
      width={650}
      bodyStyle={{ padding: '20px 24px' }}
    >
      <Banner
        type='success'
        closeIcon={null}
        description={t(
          '客户端信息如下，请立即复制保存。关闭此窗口后将无法再次查看密钥。',
        )}
        className='mb-5 !rounded-lg'
      />

      <div className='space-y-4'>
        <div className='flex justify-center items-center'>
          <div className='text-center'>
            <Text strong className='block mb-2'>
              {t('客户端ID')}
            </Text>
            <Text code copyable>
              {clientId}
            </Text>
          </div>
        </div>

        {clientSecret && (
          <div className='flex justify-center items-center'>
            <div className='text-center'>
              <Text strong className='block mb-2'>
                {t('客户端密钥（仅此一次显示）')}
              </Text>
              <Text code copyable>
                {clientSecret}
              </Text>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClientInfoModal;
