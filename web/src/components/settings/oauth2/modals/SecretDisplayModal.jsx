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

const SecretDisplayModal = ({ visible, onClose, secret }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <span>🔑</span>
          <Text strong className='ml-2'>
            {t('客户端密钥已重新生成')}
          </Text>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      cancelText=''
      okText={t('我已复制保存')}
      width={650}
      bodyStyle={{ padding: '20px 24px' }}
    >
      <Banner
        type='warning'
        description={t(
          '新的客户端密钥如下，请立即复制保存。关闭此窗口后将无法再次查看。',
        )}
        className='mb-5'
      />
      <div className='bg-gray-50 p-4 rounded-lg border font-mono break-all'>
        <Text
          code
          copyable={{
            content: secret,
            successTip: t('已复制到剪贴板'),
          }}
          style={{ fontSize: '13px', lineHeight: '1.5' }}
        >
          {secret}
        </Text>
      </div>
      <div className='mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md'>
        <Text size='small' type='tertiary'>
          💡 {t('请妥善保管此密钥，用于应用程序的身份验证')}
        </Text>
      </div>
    </Modal>
  );
};

export default SecretDisplayModal;
