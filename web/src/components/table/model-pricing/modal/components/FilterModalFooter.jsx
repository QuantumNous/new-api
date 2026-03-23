import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const FilterModalFooter = ({ onReset, onConfirm, t }) => {
  return (
    <div className='flex justify-end'>
      <Button theme='outline' type='tertiary' onClick={onReset}>
        {t('重置')}
      </Button>
      <Button theme='solid' type='primary' onClick={onConfirm}>
        {t('确定')}
      </Button>
    </div>
  );
};

export default FilterModalFooter;
