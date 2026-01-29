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

const DeleteTokensModal = ({
  visible,
  onCancel,
  onConfirm,
  selectedKeys,
  t,
}) => {
  return (
    <Modal
      title={t('批量删除令牌')}
      visible={visible}
      onCancel={onCancel}
      type='warning'
      footer={
        <div className='flex justify-end'>
          <Space>
            <Button onClick={onCancel}>{t('取消')}</Button>
            <Button type='warning' theme='solid' onClick={onConfirm}>
              {t('确定')}
            </Button>
          </Space>
        </div>
      }
    >
      <div>
        {t('确定要删除所选的 {{count}} 个令牌吗？', {
          count: selectedKeys.length,
        })}
      </div>
    </Modal>
  );
};

export default DeleteTokensModal;
