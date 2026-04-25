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
import { Bell } from 'lucide-react';

const NotificationButton = ({ unreadCount, onNoticeOpen, t }) => {
  const button = (
    <button
      type='button'
      aria-label={t('系统公告')}
      onClick={onNoticeOpen}
      className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/[0.04] text-slate-700 transition-colors hover:bg-slate-900/[0.07] dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
    >
      <Bell size={18} />
    </button>
  );

  if (unreadCount > 0) {
    return (
      <span className='relative inline-flex'>
        {button}
        <span className='absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      </span>
    );
  }

  return button;
};

export default NotificationButton;
