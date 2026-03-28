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
import { Bell } from 'lucide-react';

const iconButtonClassName =
  'inline-flex !h-8 !w-8 !min-w-8 items-center justify-center !rounded-full !p-0 !leading-none !text-current !bg-semi-color-fill-0 hover:!bg-semi-color-fill-1 focus:!bg-semi-color-fill-1 dark:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2 dark:focus:!bg-gray-700';

const NotificationButton = ({ unreadCount, onNoticeOpen, t }) => {
  const buttonProps = {
    icon: <Bell size={18} className='block' />,
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
