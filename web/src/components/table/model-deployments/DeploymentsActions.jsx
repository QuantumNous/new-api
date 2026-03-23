import React from 'react';
import { Button, Popconfirm } from '@douyinfe/semi-ui';
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
    batchDeleteDeployments();
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={handleAddDeployment}
        size='small'
      >
        {t('新建容器')}
      </Button>

      {hasSelected && (
        <>
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
            type='tertiary'
            className='flex-1 md:flex-initial'
            onClick={handleDeselectAll}
            size='small'
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
