import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const RedemptionsActions = ({
  selectedKeys,
  setEditingRedemption,
  setShowEdit,
  batchCopyRedemptions,
  batchDeleteRedemptions,
  t,
}) => {
  // Add new redemption code
  const handleAddRedemption = () => {
    setEditingRedemption({
      id: undefined,
    });
    setShowEdit(true);
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={handleAddRedemption}
        size='small'
      >
        {t('添加兑换码')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={batchCopyRedemptions}
        size='small'
      >
        {t('复制所选兑换码到剪贴板')}
      </Button>

      <Button
        type='danger'
        className='w-full md:w-auto'
        onClick={batchDeleteRedemptions}
        size='small'
      >
        {t('清除失效兑换码')}
      </Button>
    </div>
  );
};

export default RedemptionsActions;
