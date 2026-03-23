import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const SubscriptionsActions = ({ openCreate, t }) => {
  return (
    <div className='flex gap-2 w-full md:w-auto'>
      <Button
        type='primary'
        className='w-full md:w-auto'
        onClick={openCreate}
        size='small'
      >
        {t('新建套餐')}
      </Button>
    </div>
  );
};

export default SubscriptionsActions;
