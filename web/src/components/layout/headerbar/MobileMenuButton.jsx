import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconClose, IconMenu } from '@douyinfe/semi-icons';

const MobileMenuButton = ({
  isConsoleRoute,
  isMobile,
  drawerOpen,
  collapsed,
  onToggle,
  t,
}) => {
  if (!isConsoleRoute || !isMobile) {
    return null;
  }

  return (
    <Button
      icon={
        (isMobile ? drawerOpen : collapsed) ? (
          <IconClose className='text-lg' />
        ) : (
          <IconMenu className='text-lg' />
        )
      }
      aria-label={
        (isMobile ? drawerOpen : collapsed) ? t('关闭侧边栏') : t('打开侧边栏')
      }
      onClick={onToggle}
      theme='borderless'
      type='tertiary'
      className='header-icon-button header-mobile-menu !text-current !rounded-full'
    />
  );
};

export default MobileMenuButton;
