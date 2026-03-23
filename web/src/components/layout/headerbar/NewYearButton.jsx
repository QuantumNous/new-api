import React from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import fireworks from 'react-fireworks';

const NewYearButton = ({ isNewYear }) => {
  if (!isNewYear) {
    return null;
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
    }, 3000);
  };

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu className='header-dropdown-menu'>
          <Dropdown.Item
            onClick={handleNewYearClick}
            className='header-dropdown-item'
          >
            Happy New Year!!! 🎉
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Button
        theme='borderless'
        type='tertiary'
        icon={<span className='text-xl'>🎉</span>}
        aria-label='New Year'
        className='header-icon-button !text-current rounded-full'
      />
    </Dropdown>
  );
};

export default NewYearButton;
