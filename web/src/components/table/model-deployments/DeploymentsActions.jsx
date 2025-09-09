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
import {
  Button,
  Popconfirm,
} from '@douyinfe/semi-ui';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const DeploymentsActions = ({
  selectedKeys,
  setSelectedKeys,
  setEditingDeployment,
  setShowEdit,
  batchDeleteDeployments,
  batchStartDeployments,
  batchStopDeployments,
  compactMode,
  setCompactMode,
  setShowColumnSelector,
  t,
}) => {
  const hasSelected = selectedKeys.length > 0;

  const handleAddDeployment = () => {
    setEditingDeployment({ id: undefined });
    setShowEdit(true);
  };

  const handleBatchDelete = () => {
    batchDeleteDeployments();
  };

  const handleBatchStart = () => {
    batchStartDeployments();
  };

  const handleBatchStop = () => {
    batchStopDeployments();
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };


  const handleOpenColumnSelector = () => {
    setShowColumnSelector(true);
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={handleAddDeployment}
        size='small'
      >
        {t('新增部署')}
      </Button>

      {hasSelected && (
        <>
          <Button
            type='success'
            className='flex-1 md:flex-initial'
            onClick={handleBatchStart}
            disabled={selectedKeys.length === 0}
            size='small'
          >
            {t('批量启动')} ({selectedKeys.length})
          </Button>
          
          <Button
            type='warning'
            className='flex-1 md:flex-initial'
            onClick={handleBatchStop}
            disabled={selectedKeys.length === 0}
            size='small'
          >
            {t('批量停止')} ({selectedKeys.length})
          </Button>

          <Popconfirm
            title={t('确认删除')}
            content={`${t('确定要删除选中的')} ${selectedKeys.length} ${t('个部署吗？此操作不可逆。')}`}
            okText={t('删除')}
            cancelText={t('取消')}
            okType='danger'
            onConfirm={handleBatchDelete}
          >
            <Button
              type='danger'
              className='flex-1 md:flex-initial'
              disabled={selectedKeys.length === 0}
              size='small'
            >
              {t('批量删除')} ({selectedKeys.length})
            </Button>
          </Popconfirm>

          <Button
            type='secondary'
            className='flex-1 md:flex-initial'
            onClick={handleDeselectAll}
            size='small'
          >
            {t('取消选择')}
          </Button>
        </>
      )}

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />

      {/* Column Selector */}
      <Button
        type='secondary'
        className='flex-1 md:flex-initial'
        onClick={handleOpenColumnSelector}
        size='small'
      >
        {t('列设置')}
      </Button>
    </div>
  );
};

export default DeploymentsActions;