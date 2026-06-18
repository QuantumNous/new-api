import React from 'react';
import { Button, Dropdown, Modal } from '@douyinfe/semi-ui';
import { IconRefresh, IconDelete, IconTreeTriangleDown } from '@douyinfe/semi-icons';

const PreparationActions = ({
  t,
  refresh,
  selectedPreparations,
  promoteSelected,
  deleteSelected,
  batchTestPreparations,
  stopPreparationBatchTest,
  isPreparationBatchTesting,
  preparationBatchProgress,
}) => {
  const hasSelection = selectedPreparations.length > 0;

  return (
    <div className='flex flex-col md:flex-row gap-2 w-full md:w-auto'>
      <Button
        size='small'
        type='tertiary'
        disabled={!hasSelection || isPreparationBatchTesting}
        onClick={() => {
          Modal.confirm({
            title: t('确认批量晋升？'),
            content: t('选中的候选渠道会被创建为正式渠道。'),
            onOk: promoteSelected,
          });
        }}
      >
        {t('批量晋升')}
      </Button>
      {isPreparationBatchTesting ? (
        <Button size='small' type='danger' onClick={stopPreparationBatchTest}>
          {t('停止批量测试')} {preparationBatchProgress.finished}/
          {preparationBatchProgress.total}
        </Button>
      ) : (
        <Dropdown
          trigger='click'
          position='bottomLeft'
          render={
            <Dropdown.Menu>
              <Dropdown.Item
                disabled={!hasSelection}
                onClick={() => batchTestPreparations('selected')}
              >
                {t('测试勾选渠道')}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => batchTestPreparations('filtered')}>
                {t('测试当前筛选全部')}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => batchTestPreparations('all')}>
                {t('测试全部备货渠道')}
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button size='small' type='tertiary' icon={<IconTreeTriangleDown />}>
            {t('批量测试')}
          </Button>
        </Dropdown>
      )}
      <Button
        size='small'
        type='tertiary'
        icon={<IconDelete />}
        disabled={!hasSelection || isPreparationBatchTesting}
        onClick={() => {
          Modal.confirm({
            title: t('确认批量删除？'),
            content: t('删除后候选渠道会从备货池移除。'),
            onOk: deleteSelected,
          });
        }}
      >
        {t('批量删除')}
      </Button>
      <Button
        size='small'
        type='tertiary'
        icon={<IconRefresh />}
        onClick={refresh}
      >
        {t('刷新')}
      </Button>
    </div>
  );
};

export default PreparationActions;
