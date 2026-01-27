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

import React, { useState } from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';
import { showError } from '../../../helpers';

const OAuthClientsActions = ({
  selectedKeys,
  setEditingClient,
  setShowEdit,
  batchDeleteClients,
  t,
}) => {
  // Handle delete selected clients with confirmation
  const handleDeleteSelectedClients = () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个客户端！'));
      return;
    }
    Modal.confirm({
      title: t('确定要删除所选的 {{count}} 个客户端吗？', { count: selectedKeys.length }),
      content: t('此操作不可逆'),
      onOk: () => {
        batchDeleteClients();
      },
    });
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={() => {
          setEditingClient({
            client_id: undefined,
          });
          setShowEdit(true);
        }}
        size='small'
      >
        {t('添加客户端')}
      </Button>

      <Button
        type='danger'
        className='w-full md:w-auto'
        onClick={handleDeleteSelectedClients}
        size='small'
      >
        {t('删除所选')}
      </Button>
    </div>
  );
};

export default OAuthClientsActions;
