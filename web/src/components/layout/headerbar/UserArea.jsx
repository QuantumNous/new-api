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

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@heroui/react';
import {
  ChevronDown,
  CreditCard,
  KeyRound,
  LogOut,
  UserCog,
} from 'lucide-react';
import { stringToColor } from '../../../helpers';
import SkeletonWrapper from '../components/SkeletonWrapper';

const avatarPalette = {
  amber: '#d97706',
  blue: '#2563eb',
  cyan: '#0891b2',
  green: '#16a34a',
  grey: '#64748b',
  indigo: '#4f46e5',
  'light-blue': '#0284c7',
  lime: '#65a30d',
  orange: '#ea580c',
  pink: '#db2777',
  purple: '#9333ea',
  red: '#dc2626',
  teal: '#0d9488',
  violet: '#7c3aed',
  yellow: '#ca8a04',
};

const UserArea = ({
  userState,
  isLoading,
  isMobile,
  isSelfUseMode,
  logout,
  navigate,
  t,
}) => {
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (isLoading) {
    return (
      <SkeletonWrapper
        loading={true}
        type='userArea'
        width={50}
        isMobile={isMobile}
      />
    );
  }

  if (userState.user) {
    const avatarColor = stringToColor(userState.user.username);
    const menuItems = [
      {
        key: 'personal',
        label: t('个人设置'),
        icon: <UserCog size={16} />,
        action: () => navigate('/console/personal'),
      },
      {
        key: 'token',
        label: t('令牌管理'),
        icon: <KeyRound size={16} />,
        action: () => navigate('/console/token'),
      },
      {
        key: 'topup',
        label: t('钱包管理'),
        icon: <CreditCard size={16} />,
        action: () => navigate('/console/topup'),
      },
      {
        key: 'logout',
        label: t('退出'),
        icon: <LogOut size={16} />,
        action: logout,
        danger: true,
      },
    ];

    const handleMenuAction = (item) => {
      setOpen(false);
      item.action();
    };

    return (
      <div className='relative' ref={dropdownRef}>
        <button
          type='button'
          aria-label={t('用户菜单')}
          aria-haspopup='menu'
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className='inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-900/[0.04] px-1.5 pr-2 text-slate-700 transition-colors hover:bg-slate-900/[0.07] dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
        >
          <Avatar
            size='sm'
            className='h-7 w-7 text-xs text-white'
            style={{
              backgroundColor:
                avatarPalette[avatarColor] || 'var(--app-primary)',
            }}
            name={userState.user.username[0].toUpperCase()}
          />
          <span className='hidden md:inline'>
            <span className='mr-1 text-xs font-semibold text-slate-600 dark:text-slate-300'>
              {userState.user.username}
            </span>
          </span>
          <ChevronDown
            size={14}
            className='text-slate-400 dark:text-slate-500'
          />
        </button>

        {open ? (
          <div
            role='menu'
            aria-label={t('用户菜单')}
            className='absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-slate-200/80 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95'
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                type='button'
                role='menuitem'
                onClick={() => handleMenuAction(item)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/10 ${
                  item.danger ? 'text-danger' : ''
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  } else {
    const showRegisterButton = !isSelfUseMode;

    return (
      <div className='flex items-center'>
        <Link to='/login' className='flex'>
          <span
            className={`inline-flex h-9 items-center justify-center bg-slate-900/[0.04] px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-900/[0.07] dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 ${
              showRegisterButton && !isMobile
                ? 'rounded-l-full rounded-r-none'
                : 'rounded-full'
            }`}
          >
            {t('登录')}
          </span>
        </Link>
        {showRegisterButton && (
          <div className='hidden md:block'>
            <Link to='/register' className='flex -ml-px'>
              <span className='inline-flex h-9 items-center justify-center rounded-l-none rounded-r-full bg-primary px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'>
                {t('注册')}
              </span>
            </Link>
          </div>
        )}
      </div>
    );
  }
};

export default UserArea;
