import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const UsersActions = ({ setShowAddUser, t }) => {
  // Add new user
  const handleAddUser = () => {
    setShowAddUser(true);
  };

  return (
    <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button className='w-full md:w-auto' onClick={handleAddUser} size='small'>
        {t('添加用户')}
      </Button>
    </div>
  );
};

export default UsersActions;
