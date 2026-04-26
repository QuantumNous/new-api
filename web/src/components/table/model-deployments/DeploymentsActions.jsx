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
import { Button } from '@heroui/react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const DeploymentsActions = ({
  selectedKeys,
  setSelectedKeys,
  setEditingDeployment,
  setShowEdit,
  batchDeleteDeployments,
  batchOperationsEnabled = true,
  compactMode,
  setCompactMode,
  showCreateModal,
  setShowCreateModal,
  t,
}) => {
  const hasSelected = batchOperationsEnabled && selectedKeys.length > 0;

  const handleAddDeployment = () => {
    if (setShowCreateModal) {
      setShowCreateModal(true);
    } else {
      // Fallback to old behavior if setShowCreateModal is not provided
      setEditingDeployment({ id: undefined });
      setShowEdit(true);
    }
  };

  const handleBatchDelete = () => {
    if (
      window.confirm(
        `${t('确定要删除选中的')} ${selectedKeys.length} ${t('个部署吗？此操作不可逆。')}`,
      )
    ) {
      batchDeleteDeployments();
    }
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        variant='primary'
        className='flex-1 md:flex-initial'
        onPress={handleAddDeployment}
        size='sm'
      >
        {t('新建容器')}
      </Button>

      {hasSelected && (
        <>
          <Button
            variant='danger-soft'
            className='flex-1 md:flex-initial'
            isDisabled={selectedKeys.length === 0}
            onPress={handleBatchDelete}
            size='sm'
          >
            {t('批量删除')} ({selectedKeys.length})
          </Button>

          <Button
            variant='outline'
            className='flex-1 md:flex-initial'
            onPress={handleDeselectAll}
            size='sm'
          >
            {t('取消选择')}
          </Button>
        </>
      )}

      {/* Compact Mode */}
      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default DeploymentsActions;
