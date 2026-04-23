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
import { Button, Badge } from '@douyinfe/semi-ui';

const iconButtonClassName =
  'inline-flex !h-10 !w-10 !min-w-10 items-center justify-center !rounded-full !p-0 !leading-none !text-[#1877F2] hover:!text-[#1668d9] !bg-transparent hover:!bg-transparent focus:!bg-transparent dark:!text-[#60a5fa] dark:hover:!text-[#93c5fd]';

const BellIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='block'
    aria-hidden='true'
  >
    <path
      fill='currentColor'
      d='M18.75 9v.704c0 .845.24 1.671.692 2.374l1.108 1.723c1.011 1.574.239 3.713-1.52 4.21a25.8 25.8 0 0 1-14.06 0c-1.759-.497-2.531-2.636-1.52-4.21l1.108-1.723a4.4 4.4 0 0 0 .693-2.374V9c0-3.866 3.022-7 6.749-7s6.75 3.134 6.75 7'
      opacity='0.5'
    />
    <path
      fill='currentColor'
      d='M12.75 6a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0zM7.243 18.545a5.002 5.002 0 0 0 9.513 0c-3.145.59-6.367.59-9.513 0'
    />
  </svg>
);

const NotificationButton = ({ unreadCount, onNoticeOpen, t }) => {
  const buttonProps = {
    icon: <BellIcon />,
    'aria-label': t('系统公告'),
    onClick: onNoticeOpen,
    theme: 'borderless',
    type: 'tertiary',
    className: iconButtonClassName,
  };

  if (unreadCount > 0) {
    return (
      <Badge count={unreadCount} type='danger' overflowCount={99}>
        <Button {...buttonProps} />
      </Badge>
    );
  }

  return <Button {...buttonProps} />;
};

export default NotificationButton;
