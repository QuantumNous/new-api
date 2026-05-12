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
import { Modal, Button, Space } from '@douyinfe/semi-ui';

const CopyTokensModal = ({ visible, onCancel, batchCopyTokens, t }) => {
  // Handle copy with name and key format
  const handleCopyWithName = async () => {
    await batchCopyTokens('name+key');
    onCancel();
  };

  // Handle copy with key only format
  const handleCopyKeyOnly = async () => {
    await batchCopyTokens('key-only');
    onCancel();
  };

  return (
    <Modal
      title={t('复制令牌')}
      icon={null}
      visible={visible}
      onCancel={onCancel}
      footer={
        <Space>
          <Button type='tertiary' onClick={handleCopyWithName}>
            {t('名称+密钥')}
          </Button>
          <Button onClick={handleCopyKeyOnly}>{t('仅密钥')}</Button>
        </Space>
      }
    >
      {t('请选择你的复制方式')}
    </Modal>
  );
};

export default CopyTokensModal;
