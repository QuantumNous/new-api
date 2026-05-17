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
import { Button, Input, Modal, Typography } from '@douyinfe/semi-ui';
import { IconKey } from '@douyinfe/semi-icons';
import { FaQq } from 'react-icons/fa';

const { Paragraph, Text } = Typography;

const QQBindModal = ({
  t,
  showQQBindModal,
  setShowQQBindModal,
  inputs,
  handleInputChange,
  bindQQ,
  qqBindInfo,
  userId,
}) => {
  const command = qqBindInfo?.command || `/nachoai b ${userId || ''}`;

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <FaQq className='mr-2 text-blue-500' size={20} />
          {t('绑定QQ账户')}
        </div>
      }
      visible={showQQBindModal}
      onCancel={() => setShowQQBindModal(false)}
      footer={null}
      size={'small'}
      centered={true}
      className='modern-modal'
    >
      <div className='space-y-4 py-4 text-center'>
        <div className='text-gray-600 text-left space-y-3'>
          <p>
            {t('请先添加 QQ 好友')}：
            <Text strong>{qqBindInfo?.qq_number || t('管理员配置的 QQ 号')}</Text>
          </p>
          <p>{t('添加好友后发送以下内容')}</p>
          <Paragraph
            copyable={{ content: command }}
            className='!mb-0 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm'
          >
            {command}
          </Paragraph>
          <p>{t('然后在下方输入 QQ 返回的消息验证码')}</p>
        </div>
        <Input
          placeholder={t('QQ 返回的消息验证码')}
          name='qq_verification_code'
          value={inputs.qq_verification_code}
          onChange={(v) => handleInputChange('qq_verification_code', v)}
          size='large'
          className='!rounded-lg'
          prefix={<IconKey />}
        />
        <Button
          type='primary'
          theme='solid'
          size='large'
          onClick={bindQQ}
          className='!rounded-lg w-full !bg-slate-600 hover:!bg-slate-700'
          icon={<FaQq size={16} />}
        >
          {t('绑定')}
        </Button>
      </div>
    </Modal>
  );
};

export default QQBindModal;
