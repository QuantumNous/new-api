import React from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';
import { IconRefresh, IconDelete } from '@douyinfe/semi-icons';

const PreparationActions = ({
  t,
  refresh,
  selectedPreparations,
  promoteSelected,
  archiveSelected,
}) => {
  const hasSelection = selectedPreparations.length > 0;

  return (
    <div className='flex flex-col md:flex-row gap-2 w-full md:w-auto'>
      <Button
        size='small'
        type='tertiary'
        disabled={!hasSelection}
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
      <Button
        size='small'
        type='tertiary'
        icon={<IconDelete />}
        disabled={!hasSelection}
        onClick={() => {
          Modal.confirm({
            title: t('确认批量归档？'),
            content: t('归档后候选渠道不会被晋升。'),
            onOk: archiveSelected,
          });
        }}
      >
        {t('批量归档')}
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
